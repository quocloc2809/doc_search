const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const database = require('../../../shared/config/database');
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

const ZIP_DB_BATCH_SIZE = 200;

function getItemTableName(item) {
    return item.type === 'outgoing' ? 'WF_Outgoing_Doc_Files' : 'WF_Incoming_Doc_Files';
}

function getItemQueryGroupKey(item) {
    const tableName = getItemTableName(item);
    const dbKey = (item.db || '').toString().trim();
    const year = (item.year || '').toString().trim();
    const yearStr = /^\d{4}$/.test(year) ? year : '';

    if (dbKey) return `${tableName}|db|${dbKey}`;
    if (yearStr) return `${tableName}|year|${yearStr}`;
    return `${tableName}|default`;
}

async function queryFileRecordsBatch(pool, tableName, documentIds) {
    const recordMap = new Map();
    if (documentIds.length === 0) return recordMap;

    for (let i = 0; i < documentIds.length; i += ZIP_DB_BATCH_SIZE) {
        const batch = documentIds.slice(i, i + ZIP_DB_BATCH_SIZE);
        const request = pool.request();
        batch.forEach((docId, idx) => request.input(`docId${idx}`, docId));
        const inList = batch.map((_, idx) => `@docId${idx}`).join(', ');

        const result = await request.query(`
            SELECT FileID, FileName, ContentType, DocumentID
            FROM (
                SELECT FileID, FileName, ContentType, DocumentID,
                       ROW_NUMBER() OVER (PARTITION BY DocumentID ORDER BY FileID DESC) AS rn
                FROM dbo.${tableName}
                WHERE DocumentID IN (${inList})
            ) ranked
            WHERE rn = 1
        `);

        for (const row of result.recordset || []) {
            recordMap.set(row.DocumentID, row);
        }
    }

    return recordMap;
}

async function fetchFileRecordsForGroup(groupKey, groupedItems) {
    const [tableName, mode, keyValue] = groupKey.split('|');
    const documentIds = groupedItems.map(({ documentId }) => documentId);

    if (mode === 'db') {
        const pool = await database.getPoolByDbKey(keyValue);
        return queryFileRecordsBatch(pool, tableName, documentIds);
    }

    if (mode === 'year') {
        const pool = await database.getPoolForYear(keyValue);
        return queryFileRecordsBatch(pool, tableName, documentIds);
    }

    const primaryKey = database.getPrimaryKey();
    const db2020Key = database.get2020Key();
    const primaryPool = database.getPool(primaryKey);
    const recordMap = await queryFileRecordsBatch(primaryPool, tableName, documentIds);

    const missingIds = documentIds.filter((id) => !recordMap.has(id));
    if (missingIds.length > 0) {
        try {
            const po2020Pool = await database.getPoolByDbKey(db2020Key);
            const fallbackMap = await queryFileRecordsBatch(po2020Pool, tableName, missingIds);
            for (const [id, record] of fallbackMap) {
                recordMap.set(id, record);
            }
        } catch {
            // ignore legacy fallback errors
        }
    }

    return recordMap;
}

async function resolveZipEntries(items, storageRoot) {
    const skipReasons = [];
    const addedNames = new Set();
    const entries = [];
    const groups = new Map();
    const recordLookup = new Map();
    const failedDocumentIds = new Set();

    for (const item of items) {
        const documentId = parseInt(item.documentId, 10);
        if (isNaN(documentId)) {
            skipReasons.push({ id: item.documentId, reason: 'invalid_id' });
            continue;
        }

        const groupKey = getItemQueryGroupKey(item);
        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        groups.get(groupKey).push({ item, documentId });
    }

    for (const [groupKey, groupedItems] of groups) {
        try {
            const recordMap = await fetchFileRecordsForGroup(groupKey, groupedItems);
            for (const { documentId } of groupedItems) {
                recordLookup.set(`${groupKey}|${documentId}`, recordMap.get(documentId) || null);
            }
        } catch (groupErr) {
            logger.error('Zip: batch query failed for group', { groupKey, error: groupErr.message });
            for (const { documentId } of groupedItems) {
                failedDocumentIds.add(documentId);
                skipReasons.push({ id: documentId, reason: 'unexpected_error' });
            }
        }
    }

    for (const [groupKey, groupedItems] of groups) {
        for (const { item, documentId } of groupedItems) {
            if (failedDocumentIds.has(documentId)) continue;

            try {
                const fileRec = recordLookup.get(`${groupKey}|${documentId}`);
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

                const ext = path.extname(fullPath);
                const baseName = buildDownloadFileName(item.title || '', fileRec.FileName || '');
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
    }

    return { entries, skipReasons };
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

// Nén nhiều văn bản thành 1 file ZIP (stream qua archiver, không load toàn bộ vào RAM)
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
        const { entries, skipReasons } = await resolveZipEntries(items, storageRoot);

        if (entries.length === 0) {
            return res.status(422).json({ success: false, message: 'Không tìm thấy file nào để tải', skipReasons: IS_PRODUCTION ? [...new Set(skipReasons.map(s => s.reason))] : skipReasons });
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="VanBanTongHop.zip"');
        res.setHeader('X-File-Count', String(entries.length));
        res.setHeader('X-Skipped-Count', String(skipReasons.length));

        const archive = archiver('zip', { zlib: { level: 6 } });

        archive.on('warning', (err) => {
            if (err.code !== 'ENOENT') {
                logger.error('Zip archive warning', { error: err.message });
            }
        });

        archive.on('error', (err) => {
            logger.error('Zip archive error', { error: err.message });
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Server error', error: IS_PRODUCTION ? 'Internal server error' : err.message });
            } else {
                res.destroy(err);
            }
        });

        archive.pipe(res);

        for (const { fullPath, zipName } of entries) {
            archive.file(fullPath, { name: zipName });
        }

        await archive.finalize();

        audit.log('ZIP_FILES', {
            userId: req.headers['x-user-id'] || null,
            username: req.headers['x-user-name'] || null,
            fileCount: entries.length,
            skippedCount: skipReasons.length,
            ip: getClientIp(req),
        });
    } catch (error) {
        logger.error('Error creating zip', { error: error.message });
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Server error', error: IS_PRODUCTION ? 'Internal server error' : error.message });
        }
    }
});

module.exports = router;
