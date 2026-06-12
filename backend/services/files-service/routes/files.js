const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const database = require('../../../shared/config/database');
const sql = database.sql;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const createLogger = require('../../../shared/utils/logger');
const audit = require('../../../shared/utils/auditLogger');
const logger = createLogger('files');

async function querySingleFileRecord(pool, { tableName, documentId }) {
    const result = await pool
        .request()
        .input('docId', documentId)
        .query(
            `SELECT TOP 1 FileID, FileName, ContentType FROM dbo.${tableName} WHERE DocumentID = @docId ORDER BY FileID DESC`,
        );

    const rows = result.recordset || [];
    return rows.length > 0 ? rows[0] : null;
}

async function getFileRecordWithFallback({ tableName, documentId, dbKey, year }) {
    const primaryKey = database.getPrimaryKey();
    const db2020Key = database.get2020Key();

    const normalizedDbKey = (dbKey || '').toString().trim();
    const normalizedYear = (year || '').toString().trim();
    const yearStr = /^\d{4}$/.test(normalizedYear) ? normalizedYear : '';

    if (normalizedDbKey) {
        const pool = await database.getPoolByDbKey(normalizedDbKey);
        const record = await querySingleFileRecord(pool, { tableName, documentId });
        return { record, sourceDb: normalizedDbKey };
    }

    if (yearStr) {
        const pool = await database.getPoolForYear(yearStr);
        const record = await querySingleFileRecord(pool, { tableName, documentId });
        return { record, sourceDb: await database.resolveDbKeyForYear(yearStr) };
    }

    // Default: primary then legacy 2020 fallback (kept for backward compatibility)
    const primaryPool = database.getPool(primaryKey);
    let record = await querySingleFileRecord(primaryPool, { tableName, documentId });
    let sourceDb = primaryKey;

    if (!record) {
        try {
            const po2020Pool = await database.getPoolByDbKey(db2020Key);
            record = await querySingleFileRecord(po2020Pool, { tableName, documentId });
            if (record) {
                sourceDb = db2020Key;
            }
        } catch {
            // ignore
        }
    }

    return { record, sourceDb };
}

function toSafeRelativePath(filePath) {
    if (!filePath || typeof filePath !== 'string') return '';

    // Normalize separators and remove any leading slashes/backslashes so the path
    // cannot become drive-root absolute on Windows (e.g. "\\incoming\\a.pdf").
    let cleaned = filePath.trim();
    // Convert both Windows and POSIX separators to the current OS separator.
    // This is important when paths are stored with backslashes but the service
    // runs on Linux (where backslash is a valid filename character, not a separator).
    cleaned = cleaned.replace(/[\\/]+/g, path.sep);
    cleaned = cleaned.replace(/^([\\/])+/, '');
    cleaned = path.normalize(cleaned);
    cleaned = cleaned.replace(/^([\\/])+/, '');

    // Reject obvious absolute drive paths that might have been stored in DB.
    if (/^[A-Za-z]:/.test(cleaned)) {
        throw new Error('Absolute file paths are not allowed');
    }

    return cleaned;
}

function isPathInsideRoot(rootPath, candidatePath) {
    const rootResolved = path.resolve(rootPath);
    const candidateResolved = path.resolve(candidatePath);
    return candidateResolved === rootResolved || candidateResolved.startsWith(rootResolved + path.sep);
}

function getClientIp(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';
}

function buildDownloadFileName(title, storedFilePath) {
    const ext = path.extname(storedFilePath || '');
    if (title && typeof title === 'string') {
        const sanitized = title
            .trim()
            // Remove characters invalid in filenames on both Windows and Linux
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
            .trim()
            .slice(0, 200);
        if (sanitized) {
            return sanitized + ext;
        }
    }
    // Fallback: strip leading UUID prefix (UUID-originalname.ext)
    const baseName = path.basename(storedFilePath || '');
    return baseName.includes('-') ? baseName.substring(baseName.lastIndexOf('-') + 1) : baseName;
}

// Download file cho Incoming Documents
router.get('/download/incoming/:documentId', async (req, res) => {
    try {
        const documentId = parseInt(req.params.documentId, 10);
        if (isNaN(documentId)) {
            return res.status(400).json({ success: false, message: 'Invalid documentId' });
        }

        logger.debug('Download incoming request', { documentId });

        const { record: fileRec } = await getFileRecordWithFallback({
            tableName: 'WF_Incoming_Doc_Files',
            documentId,
            dbKey: req.query.db,
            year: req.query.year,
        });

        if (!fileRec) {
            return res.status(404).json({ success: false, message: 'No file found for this document' });
        }
        const filePath = fileRec.FileName || '';
        const contentType = fileRec.ContentType || 'application/octet-stream';

        logger.debug('Incoming file from DB', { filePath });

        const storageRoot = process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads');

        let relativePath;
        try {
            relativePath = toSafeRelativePath(filePath);
        } catch (e) {
            logger.warn('Invalid file path from DB (incoming)', { filePath, error: e.message });
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }
        const fullPath = path.resolve(storageRoot, relativePath);
        
        logger.debug('Resolved path', { storageRoot, fullPath });

        if (!isPathInsideRoot(storageRoot, fullPath)) {
            logger.warn('Path traversal attempt blocked', { fullPath, ip: getClientIp(req) });
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }

        if (!fs.existsSync(fullPath)) {
            logger.warn('File not found on disk', { fullPath });
            return res.status(404).json({ success: false, message: 'File not found on server' });
        }

        const downloadFileName = buildDownloadFileName(req.query.title, filePath);
        
        logger.debug('Serving file', { downloadFileName });
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFileName)}"`);

        const stream = fs.createReadStream(fullPath);
        audit.log('DOWNLOAD_INCOMING_FILE', {
            userId: req.headers['x-user-id'] || null,
            username: req.headers['x-user-name'] || null,
            documentId,
            fileName: downloadFileName,
            ip: getClientIp(req),
        });
        stream.pipe(res);
        stream.on('error', (err) => {
            logger.error('File stream error (incoming)', { error: err.message, fullPath });
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Error streaming file' });
            }
        });
    } catch (error) {
        logger.error('Error in incoming file download route', { error: error.message });
        res.status(500).json({ success: false, message: 'Server error', error: IS_PRODUCTION ? 'Internal server error' : error.message });
    }
});

// Download file cho Outgoing Documents
router.get('/download/outgoing/:documentId', async (req, res) => {
    try {
        const documentId = parseInt(req.params.documentId, 10);
        if (isNaN(documentId)) {
            return res.status(400).json({ success: false, message: 'Invalid documentId' });
        }

        logger.debug('Download outgoing request', { documentId });

        const { record: fileRec } = await getFileRecordWithFallback({
            tableName: 'WF_Outgoing_Doc_Files',
            documentId,
            dbKey: req.query.db,
            year: req.query.year,
        });

        if (!fileRec) {
            return res.status(404).json({ success: false, message: 'No file found for this document' });
        }
        const filePath = fileRec.FileName || '';
        const contentType = fileRec.ContentType || 'application/octet-stream';

        logger.debug('Outgoing file from DB', { filePath });

        const storageRoot = process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads');

        let relativePath;
        try {
            relativePath = toSafeRelativePath(filePath);
        } catch (e) {
            logger.warn('Invalid file path from DB (outgoing)', { filePath, error: e.message });
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }
        const fullPath = path.resolve(storageRoot, relativePath);
        
        logger.debug('Resolved path', { storageRoot, fullPath });

        // Kiểm tra security: file phải nằm trong storage root
        if (!isPathInsideRoot(storageRoot, fullPath)) {
            logger.warn('Path traversal attempt blocked', { fullPath, ip: getClientIp(req) });
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }

        if (!fs.existsSync(fullPath)) {
            logger.warn('File not found on disk', { fullPath });
            return res.status(404).json({ success: false, message: 'File not found on server' });
        }

        const downloadFileName = buildDownloadFileName(req.query.title, filePath);
        
        logger.debug('Serving file', { downloadFileName });
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFileName)}"`);

        const stream = fs.createReadStream(fullPath);
        audit.log('DOWNLOAD_OUTGOING_FILE', {
            userId: req.headers['x-user-id'] || null,
            username: req.headers['x-user-name'] || null,
            documentId,
            fileName: downloadFileName,
            ip: getClientIp(req),
        });
        stream.pipe(res);
        stream.on('error', (err) => {
            logger.error('File stream error (outgoing)', { error: err.message, fullPath });
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Error streaming file' });
            }
        });
    } catch (error) {
        logger.error('Error in outgoing file download route', { error: error.message });
        res.status(500).json({ success: false, message: 'Server error', error: IS_PRODUCTION ? 'Internal server error' : error.message });
    }
});

// Backward compatibility: redirect old endpoint to incoming
router.get('/download/:documentId', async (req, res) => {
    try {
        const documentId = parseInt(req.params.documentId, 10);
        if (isNaN(documentId)) {
            return res.status(400).json({ success: false, message: 'Invalid documentId' });
        }

        logger.debug('Download legacy request', { documentId });

        const { record: fileRec } = await getFileRecordWithFallback({
            tableName: 'WF_Incoming_Doc_Files',
            documentId,
            dbKey: req.query.db,
            year: req.query.year,
        });

        if (!fileRec) {
            return res.status(404).json({ success: false, message: 'No file found for this document' });
        }
        const filePath = fileRec.FileName || '';
        const contentType = fileRec.ContentType || 'application/octet-stream';

        logger.debug('Legacy file from DB', { filePath });

        const storageRoot = process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads');

        let relativePath;
        try {
            relativePath = toSafeRelativePath(filePath);
        } catch (e) {
            logger.warn('Invalid file path from DB (legacy)', { filePath, error: e.message });
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }
        const fullPath = path.resolve(storageRoot, relativePath);
        
        logger.debug('Resolved path', { storageRoot, fullPath });

        if (!isPathInsideRoot(storageRoot, fullPath)) {
            logger.warn('Path traversal attempt blocked', { fullPath, ip: getClientIp(req) });
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }

        if (!fs.existsSync(fullPath)) {
            logger.warn('File not found on disk', { fullPath });
            return res.status(404).json({ success: false, message: 'File not found on server' });
        }

        const downloadFileName = buildDownloadFileName(req.query.title, filePath);
        
        logger.debug('Serving file', { downloadFileName });
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFileName)}"`);

        const stream = fs.createReadStream(fullPath);
        audit.log('DOWNLOAD_INCOMING_FILE', {
            userId: req.headers['x-user-id'] || null,
            username: req.headers['x-user-name'] || null,
            documentId,
            fileName: downloadFileName,
            ip: getClientIp(req),
        });
        stream.pipe(res);
        stream.on('error', (err) => {
            logger.error('File stream error (legacy)', { error: err.message, fullPath });
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Error streaming file' });
            }
        });
    } catch (error) {
        logger.error('Error in file download route', { error: error.message });
        res.status(500).json({ success: false, message: 'Server error', error: IS_PRODUCTION ? 'Internal server error' : error.message });
    }
});

// Nén nhiều văn bản thành 1 file ZIP
router.post('/zip', async (req, res) => {
    try {
        const items = req.body?.items;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Danh sách văn bản không hợp lệ' });
        }
        if (items.length > 10000) {
            return res.status(400).json({ success: false, message: 'Tối đa 10000 văn bản mỗi lần tải' });
        }

        const storageRoot = process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads');
        const skipReasons = [];
        const addedNames = new Set();

        // Collect valid file entries before streaming
        const entries = [];
        for (const item of items) {
            const documentId = parseInt(item.documentId, 10);
            if (isNaN(documentId)) { skipReasons.push({ id: item.documentId, reason: 'invalid_id' }); continue; }

            const tableName = item.type === 'outgoing' ? 'WF_Outgoing_Doc_Files' : 'WF_Incoming_Doc_Files';

            try {
                const { record: fileRec } = await getFileRecordWithFallback({
                    tableName,
                    documentId,
                    dbKey: item.db,
                    year: item.year,
                });

                if (!fileRec) {
                    skipReasons.push({ id: documentId, reason: 'no_db_record' });
                    continue;
                }

                let relativePath;
                try {
                    relativePath = toSafeRelativePath(fileRec.FileName || '');
                } catch {
                    skipReasons.push({ id: documentId, reason: 'invalid_path' });
                    continue;
                }

                const fullPath = path.resolve(storageRoot, relativePath);
                if (!isPathInsideRoot(storageRoot, fullPath)) {
                    skipReasons.push({ id: documentId, reason: 'path_traversal' });
                    continue;
                }
                if (!fs.existsSync(fullPath)) {
                    logger.warn('Zip: file not found on disk', { documentId, fullPath });
                    skipReasons.push({ id: documentId, reason: 'file_not_on_disk' });
                    continue;
                }

                // Build formatted file name
                const ext = path.extname(fullPath);
                const baseName = buildDownloadFileName(item.title || '', fileRec.FileName || '');
                // De-duplicate: append documentId if name already used
                let zipName = baseName;
                if (addedNames.has(zipName)) {
                    zipName = path.basename(baseName, ext) + '_' + documentId + ext;
                }
                addedNames.add(zipName);

                entries.push({ fullPath, zipName, documentId });
            } catch (itemErr) {
                logger.error('Zip: unexpected error for item', { documentId, error: itemErr.message });
                skipReasons.push({ id: documentId, reason: 'unexpected_error' });
            }
        }

        if (entries.length === 0) {
            return res.status(422).json({ success: false, message: 'Không tìm thấy file nào để tải', skipReasons: IS_PRODUCTION ? [...new Set(skipReasons.map(s => s.reason))] : skipReasons });
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="VanBanTongHop.zip"');
        res.setHeader('X-File-Count', entries.length);
        res.setHeader('X-Skipped-Count', skipReasons.length);

        // Build ZIP using Node.js built-in zlib (no external deps)
        const CRC_TABLE = (() => {
            const t = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let c = i;
                for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                t[i] = c;
            }
            return t;
        })();
        function crc32(buf) {
            let c = 0xFFFFFFFF;
            for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
            return (c ^ 0xFFFFFFFF) >>> 0;
        }

        const localHeaders = [];
        const centralDirs = [];
        let offset = 0;
        const now = new Date();
        const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) >>> 0;
        const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) >>> 0;

        for (const { fullPath, zipName } of entries) {
            const raw = fs.readFileSync(fullPath);
            const cmp = zlib.deflateRawSync(raw, { level: 6 });
            const fileData = cmp.length < raw.length ? cmp : raw;
            const method = cmp.length < raw.length ? 8 : 0;
            const crc = crc32(raw);
            const nameBytes = Buffer.from(zipName, 'utf8');

            const lh = Buffer.alloc(30 + nameBytes.length);
            lh.writeUInt32LE(0x04034b50, 0);
            lh.writeUInt16LE(20, 4);
            lh.writeUInt16LE(0x0800, 6);
            lh.writeUInt16LE(method, 8);
            lh.writeUInt16LE(dosTime, 10);
            lh.writeUInt16LE(dosDate, 12);
            lh.writeUInt32LE(crc, 14);
            lh.writeUInt32LE(fileData.length, 18);
            lh.writeUInt32LE(raw.length, 22);
            lh.writeUInt16LE(nameBytes.length, 26);
            lh.writeUInt16LE(0, 28);
            nameBytes.copy(lh, 30);
            localHeaders.push(lh, fileData);

            const cd = Buffer.alloc(46 + nameBytes.length);
            cd.writeUInt32LE(0x02014b50, 0);
            cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
            cd.writeUInt16LE(0x0800, 8);
            cd.writeUInt16LE(method, 10);
            cd.writeUInt16LE(dosTime, 12);
            cd.writeUInt16LE(dosDate, 14);
            cd.writeUInt32LE(crc, 16);
            cd.writeUInt32LE(fileData.length, 20);
            cd.writeUInt32LE(raw.length, 24);
            cd.writeUInt16LE(nameBytes.length, 28);
            cd.fill(0, 30, 42);
            cd.writeUInt32LE(offset, 42);
            nameBytes.copy(cd, 46);
            centralDirs.push(cd);

            offset += lh.length + fileData.length;
        }

        const cdBuf = Buffer.concat(centralDirs);
        const eocd = Buffer.alloc(22);
        eocd.writeUInt32LE(0x06054b50, 0);
        eocd.fill(0, 4, 8);
        eocd.writeUInt16LE(entries.length, 8);
        eocd.writeUInt16LE(entries.length, 10);
        eocd.writeUInt32LE(cdBuf.length, 12);
        eocd.writeUInt32LE(offset, 16);
        eocd.writeUInt16LE(0, 20);

        const zipBuffer = Buffer.concat([...localHeaders, cdBuf, eocd]);
        res.setHeader('Content-Length', zipBuffer.length);
        res.end(zipBuffer);

        audit.log('ZIP_FILES', {
            userId: req.headers['x-user-id'] || null,
            username: req.headers['x-user-name'] || null,
            fileCount: entries.length,
            skippedCount: skipReasons.length,
            ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '',
        });
    } catch (error) {
        logger.error('Error creating zip', { error: error.message });
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Server error', error: IS_PRODUCTION ? 'Internal server error' : error.message });
        }
    }
});

module.exports = router;
