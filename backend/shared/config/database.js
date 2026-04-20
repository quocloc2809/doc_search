const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PRIMARY_DB_KEY = 'primary';
// Back-compat alias (kept for older env/config usage)
const DB2020_KEY = 'po2020';
const ARCHIVE_KEY_PREFIX = 'archive_';

const ARCHIVE_YEARS_CACHE_TTL_MS = 5 * 60 * 1000;

function getPrimaryDatabaseName() {
    return process.env.DB_DATABASE || process.env.DB_NAME;
}

function get2020DatabaseName() {
    return process.env.DB_DATABASE_2020 || process.env.DB_NAME_2020;
}

function parseArchiveDatabasesFromEnv() {
    // Supported formats:
    // - DB_ARCHIVE_DATABASES="2020=VEC-PO2020,2019=VEC-PO2019"
    // - DB_ARCHIVE_DATABASES="2020:VEC-PO2020;2019:VEC-PO2019"
    // Also supports legacy env var DB_*_2020 for year 2020.
    const raw = (process.env.DB_ARCHIVE_DATABASES || '').trim();
    const yearToDb = new Map();

    const db2020 = get2020DatabaseName();
    if (db2020) {
        yearToDb.set('2020', db2020);
    }

    if (!raw) {
        return yearToDb;
    }

    const entries = raw
        .split(/[;,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    for (const entry of entries) {
        const [yearRaw, dbRaw] = entry.split(/[:=]/).map((s) => (s || '').trim());
        if (!yearRaw || !dbRaw) continue;
        if (!/^\d{4}$/.test(yearRaw)) continue;
        yearToDb.set(yearRaw, dbRaw);
    }

    return yearToDb;
}

function resolveArchiveDatabaseName(year) {
    const yearStr = String(year || '').trim();
    if (!/^\d{4}$/.test(yearStr)) return null;

    const archiveMap = parseArchiveDatabasesFromEnv();
    if (archiveMap.has(yearStr)) {
        return archiveMap.get(yearStr);
    }

    const pattern = (process.env.DB_ARCHIVE_PATTERN || '').trim();
    // Example: DB_ARCHIVE_PATTERN="VEC-PO{year}"
    if (pattern && pattern.includes('{year}')) {
        return pattern.replaceAll('{year}', yearStr);
    }

    return null;
}

function escapeLike(value) {
    return String(value || '').replace(/[\[\]%_]/g, (m) => `\\${m}`);
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildConfig(databaseName) {
    return {
        server: process.env.DB_SERVER,
        database: databaseName,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT, 10) || 1433,
        options: {
            encrypt: process.env.DB_ENCRYPT === 'true',
            trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
            enableArithAbort: true,
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000,
        },
        connectionTimeout: 30000,
        requestTimeout: 30000,
    };
}

class Database {
    constructor() {
        // Back-compat: keep `pool` as the primary pool.
        this.pool = null;
        this.pools = new Map();

        this._archiveYearsCache = { ts: 0, data: null };
    }

    _getArchivePattern() {
        const pattern = (process.env.DB_ARCHIVE_PATTERN || '').trim();
        if (!pattern || !pattern.includes('{year}')) return null;
        return pattern;
    }

    _getArchiveYearsFromEnvSet() {
        const archiveMap = parseArchiveDatabasesFromEnv();
        return new Set(
            Array.from(archiveMap.keys()).filter((y) => /^\d{4}$/.test(y)),
        );
    }

    async _getArchiveYearsFromServerCached() {
        const pattern = this._getArchivePattern();
        if (!pattern) return [];

        const now = Date.now();
        if (
            this._archiveYearsCache.data &&
            now - this._archiveYearsCache.ts < ARCHIVE_YEARS_CACHE_TTL_MS
        ) {
            return this._archiveYearsCache.data;
        }

        const [prefix, suffix] = pattern.split('{year}');
        const likePattern = `${escapeLike(prefix)}____${escapeLike(suffix)}`;
        const regex = new RegExp(
            `^${escapeRegex(prefix)}(\\d{4})${escapeRegex(suffix)}$`,
        );

        try {
            const primaryPool = this.getPool(PRIMARY_DB_KEY);
            if (!primaryPool) {
                return [];
            }

            const result = await primaryPool
                .request()
                .input('likePattern', sql.NVarChar, likePattern)
                .query(
                    `SELECT name FROM sys.databases WHERE name LIKE @likePattern ESCAPE '\\'`,
                );

            const names = (result.recordset || [])
                .map((r) => r.name)
                .filter(Boolean);

            const years = [];
            for (const name of names) {
                const m = String(name).match(regex);
                if (m && m[1]) years.push(m[1]);
            }

            this._archiveYearsCache = { ts: now, data: years };
            return years;
        } catch {
            // Permission may block listing DBs; ignore and rely on env mapping.
            this._archiveYearsCache = { ts: now, data: [] };
            return [];
        }
    }

    async shouldUseArchiveDbForYear(year) {
        const yearStr = String(year || '').trim();
        if (!/^\d{4}$/.test(yearStr)) return false;

        // If explicitly mapped in env => use archive DB.
        const envYears = this._getArchiveYearsFromEnvSet();
        if (envYears.has(yearStr)) return true;

        // If pattern exists, only use it when the DB is confirmed to exist on server.
        const pattern = this._getArchivePattern();
        if (!pattern) return false;

        const serverYears = await this._getArchiveYearsFromServerCached();
        return serverYears.includes(yearStr);
    }

    async resolveDbKeyForYear(year) {
        const yearStr = String(year || '').trim();
        if (!/^\d{4}$/.test(yearStr)) return PRIMARY_DB_KEY;

        const key = this.getArchiveKeyForYear(yearStr);
        if (!key) return PRIMARY_DB_KEY;

        const shouldUseArchive = await this.shouldUseArchiveDbForYear(yearStr);
        return shouldUseArchive ? key : PRIMARY_DB_KEY;
    }

    async connectPool(key, databaseName) {
        if (!databaseName) {
            throw new Error('Database name is required');
        }

        if (this.pools.has(key)) {
            return this.pools.get(key);
        }

        const config = buildConfig(databaseName);
        const pool = new sql.ConnectionPool(config);

        pool.on('error', (err) => {
            console.error(`❌ SQL pool error (${key})`, err);
        });

        await pool.connect();
        this.pools.set(key, pool);
        return pool;
    }

    async connect() {
        try {
            const primaryDb = getPrimaryDatabaseName();
            if (!primaryDb) {
                throw new Error('Missing DB_DATABASE/DB_NAME for primary database');
            }

            this.pool = await this.connectPool(PRIMARY_DB_KEY, primaryDb);
            console.log(`✅ Kết nối SQL Server thành công! (${PRIMARY_DB_KEY}: ${primaryDb})`);

            return this.pool;
        } catch (error) {
            console.error('❌ Lỗi kết nối SQL Server:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            const pools = Array.from(this.pools.values());
            await Promise.all(
                pools.map(async (p) => {
                    try {
                        await p.close();
                    } catch {
                        // ignore
                    }
                }),
            );

            this.pools.clear();
            this.pool = null;
            console.log('✅ Đã ngắt kết nối SQL Server');
        } catch (error) {
            console.error('❌ Lỗi ngắt kết nối:', error);
        }
    }

    hasPool(key) {
        return this.pools.has(key);
    }

    getPool(key = PRIMARY_DB_KEY) {
        if (key && this.pools.has(key)) {
            return this.pools.get(key);
        }

        return this.pool;
    }

    getDbKeys() {
        return Array.from(this.pools.keys());
    }

    getPrimaryKey() {
        return PRIMARY_DB_KEY;
    }

    get2020Key() {
        return DB2020_KEY;
    }

    getArchiveKeyForYear(year) {
        const yearStr = String(year || '').trim();
        if (!/^\d{4}$/.test(yearStr)) return null;
        return `${ARCHIVE_KEY_PREFIX}${yearStr}`;
    }

    getDbKeyForYear(year) {
        // NOTE: This is a synchronous helper kept for backward compatibility.
        // It only returns an archive key when the year is explicitly mapped via env.
        // For pattern-based archives, use `await resolveDbKeyForYear(year)`.
        const yearStr = String(year || '').trim();
        if (!/^\d{4}$/.test(yearStr)) return PRIMARY_DB_KEY;

        const archiveMap = parseArchiveDatabasesFromEnv();
        if (!archiveMap.has(yearStr)) return PRIMARY_DB_KEY;

        const key = this.getArchiveKeyForYear(yearStr);
        return key || PRIMARY_DB_KEY;
    }

    getArchiveYearsFromEnv() {
        const archiveMap = parseArchiveDatabasesFromEnv();
        return Array.from(archiveMap.keys()).filter((y) => /^\d{4}$/.test(y));
    }

    async getPoolForYear(year) {
        const yearStr = String(year || '').trim();
        if (!/^\d{4}$/.test(yearStr)) {
            return this.getPool(PRIMARY_DB_KEY);
        }

        const shouldUseArchive = await this.shouldUseArchiveDbForYear(yearStr);
        if (!shouldUseArchive) {
            return this.getPool(PRIMARY_DB_KEY);
        }

        const archiveDbName = resolveArchiveDatabaseName(yearStr);
        const key = this.getArchiveKeyForYear(yearStr);

        if (archiveDbName && key) {
            return await this.connectPool(key, archiveDbName);
        }

        return this.getPool(PRIMARY_DB_KEY);
    }

    async getPoolByDbKey(dbKey) {
        if (!dbKey || typeof dbKey !== 'string') {
            return this.getPool(PRIMARY_DB_KEY);
        }

        if (dbKey === PRIMARY_DB_KEY) {
            return this.getPool(PRIMARY_DB_KEY);
        }

        // Back-compat: db=po2020
        if (dbKey === DB2020_KEY) {
            const db2020 = get2020DatabaseName();
            if (!db2020) {
                return this.getPool(PRIMARY_DB_KEY);
            }
            return await this.connectPool(DB2020_KEY, db2020);
        }

        // archive_YYYY
        if (dbKey.startsWith(ARCHIVE_KEY_PREFIX)) {
            const yearStr = dbKey.slice(ARCHIVE_KEY_PREFIX.length);
            if (!/^\d{4}$/.test(yearStr)) {
                return this.getPool(PRIMARY_DB_KEY);
            }
            return await this.getPoolForYear(yearStr);
        }

        // Unknown key => primary
        return this.getPool(PRIMARY_DB_KEY);
    }
}

const instance = new Database();
instance.sql = sql;
module.exports = instance;
