const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
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

// Merge nhiều văn bản thành 1 PDF
router.post('/merge', async (req, res) => {
    try {
        const items = req.body?.items;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Danh sách văn bản không hợp lệ' });
        }
        if (items.length > 100) {
            return res.status(400).json({ success: false, message: 'Tối đa 100 văn bản mỗi lần merge' });
        }

        const storageRoot = process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads');
        const mergedPdf = await PDFDocument.create();
        let mergedCount = 0;
        const skipped = [];

        for (const item of items) {
            const documentId = parseInt(item.documentId, 10);
            if (isNaN(documentId)) { skipped.push(item.documentId); continue; }

            const tableName = item.type === 'outgoing' ? 'WF_Outgoing_Doc_Files' : 'WF_Incoming_Doc_Files';

            try {
                const { record: fileRec } = await getFileRecordWithFallback({
                    tableName,
                    documentId,
                    dbKey: item.db,
                    year: item.year,
                });

                if (!fileRec) { skipped.push(documentId); continue; }

                let relativePath;
                try {
                    relativePath = toSafeRelativePath(fileRec.FileName || '');
                } catch {
                    skipped.push(documentId); continue;
                }

                const fullPath = path.resolve(storageRoot, relativePath);
                if (!isPathInsideRoot(storageRoot, fullPath) || !fs.existsSync(fullPath)) {
                    skipped.push(documentId); continue;
                }

                const contentType = (fileRec.ContentType || '').toLowerCase();
                const ext = path.extname(fullPath).toLowerCase();
                const isPdf = contentType.includes('pdf') || ext === '.pdf';
                if (!isPdf) { skipped.push(documentId); continue; }

                const fileBytes = fs.readFileSync(fullPath);
                let srcPdf;
                try {
                    srcPdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
                } catch {
                    skipped.push(documentId); continue;
                }

                const copiedPages = await mergedPdf.copyPagesFrom(srcPdf, srcPdf.getPageIndices());
                copiedPages.forEach(page => mergedPdf.addPage(page));
                mergedCount += 1;
            } catch {
                skipped.push(documentId);
            }
        }

        if (mergedCount === 0) {
            return res.status(422).json({ success: false, message: 'Không có file PDF nào có thể merge', skipped });
        }

        const mergedBytes = await mergedPdf.save();

        audit.log('MERGE_FILES', {
            userId: req.headers['x-user-id'] || null,
            username: req.headers['x-user-name'] || null,
            mergedCount,
            skipped,
            ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '',
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="VanBanTongHop.pdf"');
        res.setHeader('X-Merged-Count', mergedCount);
        res.setHeader('X-Skipped-Count', skipped.length);
        res.end(Buffer.from(mergedBytes));
    } catch (error) {
        logger.error('Error merging files', { error: error.message });
        res.status(500).json({ success: false, message: 'Server error', error: IS_PRODUCTION ? 'Internal server error' : error.message });
    }
});

module.exports = router;
