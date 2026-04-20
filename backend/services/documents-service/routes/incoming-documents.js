const express = require('express');
const router = express.Router();
const database = require('../../../shared/config/database');
const sql = database.sql;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const createLogger = require('../../../shared/utils/logger');
const logger = createLogger('documents');

const YEARS_CACHE_TTL_MS = 5 * 60 * 1000;
let yearsCache = { ts: 0, data: null };

function escapeLike(value) {
    return String(value || '').replace(/[\[\]%_]/g, m => `\\${m}`);
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getYearsFromPrimaryDb(pool) {
    const [incoming, outgoing] = await Promise.all([
        pool.request().query(`
            SELECT
                MIN(YEAR(COALESCE(CreatedDate, ReceivedDate))) AS minYear,
                MAX(YEAR(COALESCE(CreatedDate, ReceivedDate))) AS maxYear
            FROM dbo.WF_Incoming_Docs
            WHERE COALESCE(CreatedDate, ReceivedDate) IS NOT NULL
        `),
        pool.request().query(`
            SELECT
                MIN(YEAR(COALESCE(CreatedDate, SignedDate))) AS minYear,
                MAX(YEAR(COALESCE(CreatedDate, SignedDate))) AS maxYear
            FROM dbo.WF_Outgoing_Docs
            WHERE COALESCE(CreatedDate, SignedDate) IS NOT NULL
        `),
    ]);

    const inRow = incoming.recordset?.[0] || {};
    const outRow = outgoing.recordset?.[0] || {};

    const minCandidates = [
        Number(inRow.minYear),
        Number(outRow.minYear),
    ].filter(Number.isFinite);
    const maxCandidates = [
        Number(inRow.maxYear),
        Number(outRow.maxYear),
    ].filter(Number.isFinite);

    if (minCandidates.length === 0 || maxCandidates.length === 0) {
        return [];
    }

    const minYear = Math.min(...minCandidates);
    const maxYear = Math.max(...maxCandidates);
    if (
        !Number.isFinite(minYear) ||
        !Number.isFinite(maxYear) ||
        maxYear < minYear
    ) {
        return [];
    }

    const years = [];
    for (let y = maxYear; y >= minYear; y -= 1) {
        years.push(String(y));
    }
    return years;
}

async function getArchiveYearsFromServer(pool) {
    const pattern = (process.env.DB_ARCHIVE_PATTERN || '').trim();
    if (!pattern || !pattern.includes('{year}')) {
        return [];
    }

    const [prefix, suffix] = pattern.split('{year}');
    const likePattern = `${escapeLike(prefix)}____${escapeLike(suffix)}`;
    const regex = new RegExp(
        `^${escapeRegex(prefix)}(\\d{4})${escapeRegex(suffix)}$`,
    );

    try {
        const result = await pool
            .request()
            .input('likePattern', sql.NVarChar, likePattern)
            .query(
                `SELECT name FROM sys.databases WHERE name LIKE @likePattern ESCAPE '\\'`,
            );

        const names = (result.recordset || []).map(r => r.name).filter(Boolean);
        const years = [];
        for (const name of names) {
            const m = String(name).match(regex);
            if (m && m[1]) {
                years.push(m[1]);
            }
        }
        return years;
    } catch (e) {
        // Permission may block listing DBs; ignore and rely on env mapping.
        logger.warn('Cannot list archive DBs from sys.databases', {
            error: e?.message || String(e),
        });
        return [];
    }
}

router.get('/available-years', async (req, res) => {
    try {
        const now = Date.now();
        if (yearsCache.data && now - yearsCache.ts < YEARS_CACHE_TTL_MS) {
            return res.json({ success: true, data: yearsCache.data });
        }

        const primaryPool = database.getPool();

        const [primaryYears, envArchiveYears, serverArchiveYears] =
            await Promise.all([
                getYearsFromPrimaryDb(primaryPool),
                Promise.resolve(database.getArchiveYearsFromEnv()),
                getArchiveYearsFromServer(primaryPool),
            ]);

        const merged = Array.from(
            new Set([
                ...(primaryYears || []),
                ...(envArchiveYears || []),
                ...(serverArchiveYears || []),
            ]),
        )
            .filter(y => /^\d{4}$/.test(y))
            .sort((a, b) => Number(b) - Number(a));

        yearsCache = { ts: now, data: merged };

        return res.json({ success: true, data: merged });
    } catch (error) {
        logger.error('Error getting available years', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message,
        });
    }
});

function sortByCreatedDateDescThenIdDesc(a, b) {
    const aTime = a?.CreatedDate ? new Date(a.CreatedDate).getTime() : 0;
    const bTime = b?.CreatedDate ? new Date(b.CreatedDate).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    const aId = Number(a?.DocumentID || 0);
    const bId = Number(b?.DocumentID || 0);
    return bId - aId;
}

async function queryIncomingList(
    pool,
    { hasGroupFilter, groupIdNum, year, sql },
) {
    const request = pool.request();
    const conditions = [];

    if (hasGroupFilter) {
        request.input('groupId', sql.Int, groupIdNum);
        // Some records use negative IDs (portal), while the user group id is positive.
        // Match consistently with how the UI normalizes IDs.
        conditions.push('ABS(doc.AssignedGroupID) = @groupId');
    }

    if (year && Number.isFinite(Number(year))) {
        const y = Number(year);
        const start = new Date(y, 0, 1);
        const end = new Date(y + 1, 0, 1);
        request.input('startDate', sql.DateTime2, start);
        request.input('endDate', sql.DateTime2, end);
        // Older/archived DBs may not populate CreatedDate reliably; fallback to ReceivedDate.
        // Avoid COALESCE() in WHERE for performance (it can prevent index usage).
        conditions.push(`(
            (doc.CreatedDate >= @startDate AND doc.CreatedDate < @endDate)
            OR
            (doc.CreatedDate IS NULL AND doc.ReceivedDate >= @startDate AND doc.ReceivedDate < @endDate)
        )`);
    }

    const result = await request.query(`
        SELECT
            doc.DocumentID,
            doc.DocumentNo,
            COALESCE(doc.CreatedDate, doc.ReceivedDate) AS CreatedDate,
            COALESCE(doc.ReceivedDate, doc.CreatedDate) AS ReceivedDate,
            doc.DocumentSummary,
            COALESCE(NULLIF(LTRIM(RTRIM(o.Name)), ''), NULLIF(LTRIM(RTRIM(doc.issuedOrganizationName2)), ''), '') AS IssuedOrganizationName,
            doc.UpdatedDate,
            doc.ExpiredDate,
            doc.Status,
            doc.AssignedGroupID,
            doc.AssignedReviewedUserID,
            doc.CompletedDate,
            CASE
                WHEN doc.AssignedGroupID > 0 THEN COALESCE(grp.GroupName, '')
                WHEN doc.AssignedGroupID < 0 THEN COALESCE(portal.PortalName, '')
                ELSE ''
            END AS GroupName,
            NULLIF(LTRIM(RTRIM(COALESCE(usr.Lastname, '') + ' ' + COALESCE(usr.FirstName, ''))), '') as LeaderName
        FROM dbo.WF_Incoming_Docs doc
        LEFT JOIN dbo.WF_Organizations o ON o.OrganizationId = doc.IssuedOrganizationID
        LEFT JOIN dbo.Core_Groups grp ON doc.AssignedGroupID > 0 AND grp.GroupID = doc.AssignedGroupID AND grp.IsView = 0 AND grp.IsShow = 1
        LEFT JOIN dbo.Core_Portals portal ON doc.AssignedGroupID < 0 AND portal.PortalId = ABS(doc.AssignedGroupID)
        LEFT JOIN dbo.Core_Users usr ON usr.UserID = doc.AssignedReviewedUserID
        ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
        ORDER BY COALESCE(doc.CreatedDate, doc.ReceivedDate) DESC, doc.DocumentID DESC
    `);

    return result.recordset || [];
}

router.get('/', async (req, res) => {
    try {
        const rawYear = (req.query.year || '').toString().trim();
        const year = /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
        const sourceKey = year
            ? await database.resolveDbKeyForYear(rawYear)
            : database.getPrimaryKey();
        const pool = year
            ? await database.getPoolForYear(rawYear)
            : database.getPool();

        const userRole = (req.headers['x-user-role'] || '')
            .toString()
            .toLowerCase();
        const userGroupId = req.headers['x-user-group-id'] || '';
        const groupIdNum = parseInt(userGroupId, 10);
        const isAdmin = userRole === 'admin';
        const hasGroupFilter =
            !isAdmin && Number.isFinite(groupIdNum) && groupIdNum !== 0;

        const rows = (
            await queryIncomingList(pool, {
                hasGroupFilter,
                groupIdNum,
                year,
                sql,
            })
        )
            .map(r => ({ ...r, SourceDb: sourceKey }))
            .sort(sortByCreatedDateDescThenIdDesc);

        // Leader (lãnh đạo bút phê) logic: use LeaderName joined from Core_Users
        // If LeaderName is null/empty => chưa bút phê, otherwise đã bút phê.
        const leaderDone = rows.reduce(
            (acc, r) => (r.LeaderName ? acc + 1 : acc),
            0,
        );
        const leaderUndone = Math.max(0, rows.length - leaderDone);

        // Office logic: use CompletedDate instead of Status
        // If CompletedDate is present => processed; if null/empty => unprocessed
        const processed = rows.reduce(
            (acc, r) => (r.CompletedDate ? acc + 1 : acc),
            0,
        );
        const unprocessed = rows.reduce(
            (acc, r) => (!r.CompletedDate ? acc + 1 : acc),
            0,
        );

        const statsObj = {
            leader: {
                column: 'LeaderName',
                done: leaderDone,
                undone: leaderUndone,
                total: rows.length,
            },
            office: {
                processed: processed,
                unprocessed: unprocessed,
                total: rows.length,
            },
        };

        logger.debug('Incoming documents stats', { stats: statsObj });

        res.json({
            success: true,
            data: rows,
            stats: statsObj,
        });
    } catch (error) {
        logger.error('Lỗi lấy danh sách công văn', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message,
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const primaryKey = database.getPrimaryKey();
        const db2020Key = database.get2020Key();

        const dbKey = (req.query.db || '').toString().trim();
        const rawYear = (req.query.year || '').toString().trim();
        const year = /^\d{4}$/.test(rawYear) ? rawYear : null;

        let pool = null;
        let sourceDb = primaryKey;

        if (dbKey) {
            pool = await database.getPoolByDbKey(dbKey);
            sourceDb = dbKey;
        } else if (year) {
            pool = await database.getPoolForYear(year);
            sourceDb = await database.resolveDbKeyForYear(year);
        } else {
            pool = database.getPool(primaryKey);
            sourceDb = primaryKey;
        }

        const queryDetail = async pool =>
            pool.request().input('id', sql.Int, id).query(`
            SELECT
              doc.DocumentID,
              doc.DocumentNo,
              doc.ReceivedDate,
              doc.DocumentSummary,
              doc.issuedOrganizationName2,
              CASE
                    WHEN doc.AssignedGroupID > 0 THEN COALESCE(grp.GroupName, '')
                    WHEN doc.AssignedGroupID < 0 THEN COALESCE(portal.PortalName, '')
                    ELSE ''
                   END AS GroupName,
              COALESCE(b.Name, '') AS BookName,
              COALESCE(f.FileName, '') AS FileName,
              COALESCE(o.Name, '') AS IssuedOrganizationName,
              NULLIF(LTRIM(RTRIM(COALESCE(usr.Lastname, '') + ' ' + COALESCE(usr.FirstName, ''))), '') AS LeaderName,
              NULLIF(LTRIM(RTRIM(COALESCE(usr1.Lastname, '') + ' ' + COALESCE(usr1.FirstName, ''))), '') AS AssignedUserName
            FROM dbo.WF_Incoming_Docs doc
            LEFT JOIN dbo.WF_Books b ON b.BookID = doc.BookID
            LEFT JOIN dbo.WF_Organizations o ON o.OrganizationId = doc.IssuedOrganizationID
            LEFT JOIN dbo.Core_Users usr ON usr.UserID = doc.AssignedReviewedUserID
            LEFT JOIN dbo.Core_Users usr1 ON usr1.UserID = doc.AssignedUserID
            LEFT JOIN (
                SELECT DocumentID, FileName, FileID,
                ROW_NUMBER() OVER (PARTITION BY DocumentID ORDER BY CreatedDate DESC) as rn
                FROM dbo.WF_Incoming_Doc_Files
            ) f ON f.DocumentID = doc.DocumentID AND f.rn = 1
           LEFT JOIN dbo.Core_Groups grp ON doc.AssignedGroupID > 0 AND grp.GroupID = doc.AssignedGroupID AND grp.IsView = 0 AND grp.IsShow = 1
           LEFT JOIN dbo.Core_Portals portal ON doc.AssignedGroupID < 0 AND portal.PortalId = ABS(doc.AssignedGroupID)
            WHERE doc.DocumentID = @id
            `);

        let result = await queryDetail(pool);

        // Back-compat fallback: if client didn't specify db/year, still try the legacy 2020 DB.
        if (
            (!result.recordset || result.recordset.length === 0) &&
            !dbKey &&
            !year
        ) {
            try {
                const po2020Pool = await database.getPoolByDbKey(db2020Key);
                result = await queryDetail(po2020Pool);
                if (result.recordset && result.recordset.length > 0) {
                    sourceDb = db2020Key;
                }
            } catch {
                // ignore
            }
        }

        logger.debug('Incoming document detail', {
            id,
            documentId: result.recordset[0]?.DocumentID,
        });

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy công văn đến',
            });
        }
        res.json({
            success: true,
            data: { ...result.recordset[0], SourceDb: sourceDb },
        });
    } catch (error) {
        logger.error('Lỗi lấy chi tiết công văn đến', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message,
        });
    }
});

module.exports = router;
