const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const database = require('../../../shared/config/database');
const sql = database.sql;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const createLogger = require('../../../shared/utils/logger');
const audit = require('../../../shared/utils/auditLogger');
const logger = createLogger('files');

function getClientIp(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '';
}

// Download file cho Incoming Documents
router.get('/download/incoming/:documentId', async (req, res) => {
    try {
        const documentId = parseInt(req.params.documentId, 10);
        if (isNaN(documentId)) {
            return res.status(400).json({ success: false, message: 'Invalid documentId' });
        }

        const pool = database.getPool();
        
        logger.debug('Download incoming request', { documentId });
        
        const result = await pool.request()
            .input('docId', documentId)
            .query(`SELECT TOP 1 FileID, FileName, ContentType FROM dbo.WF_Incoming_Doc_Files WHERE DocumentID = @docId ORDER BY FileID DESC`);

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'No file found for this document' });
        }

        const fileRec = result.recordset[0];
        const filePath = fileRec.FileName || '';
        const contentType = fileRec.ContentType || 'application/octet-stream';

        logger.debug('Incoming file from DB', { filePath });

        const storageRoot = process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads');

        // Xử lý path: bỏ / hoặc \ đầu tiên nếu có
        let relativePath = filePath.replace(/^[\/\\]/, '');
        const fullPath = path.resolve(storageRoot, relativePath);
        
        logger.debug('Resolved path', { storageRoot, fullPath });

        if (!fullPath.startsWith(path.resolve(storageRoot))) {
            logger.warn('Path traversal attempt blocked', { fullPath, ip: getClientIp(req) });
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }

        if (!fs.existsSync(fullPath)) {
            logger.warn('File not found on disk', { fullPath });
            return res.status(404).json({ success: false, message: 'File not found on server' });
        }

        const baseName = path.basename(fullPath);
        // Lấy tên file gốc: nếu có UUID-originalname.ext thì lấy originalname.ext
        const originalFileName = baseName.includes('-') 
            ? baseName.substring(baseName.lastIndexOf('-') + 1) 
            : baseName;
        
        logger.debug('Serving file', { baseName, originalFileName });
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFileName)}"`);

        const stream = fs.createReadStream(fullPath);
        audit.log('DOWNLOAD_INCOMING_FILE', {
            userId: req.headers['x-user-id'] || null,
            documentId,
            fileName: originalFileName,
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

        const pool = database.getPool();
        
        logger.debug('Download outgoing request', { documentId });
        
        const result = await pool.request()
            .input('docId', documentId)
            .query(`SELECT TOP 1 FileID, FileName, ContentType FROM dbo.WF_Outgoing_Doc_Files WHERE DocumentID = @docId ORDER BY FileID DESC`);

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'No file found for this document' });
        }

        const fileRec = result.recordset[0];
        const filePath = fileRec.FileName || '';
        const contentType = fileRec.ContentType || 'application/octet-stream';

        logger.debug('Outgoing file from DB', { filePath });

        const storageRoot = process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads');

        // Xử lý path: bỏ / hoặc \ đầu tiên nếu có
        let relativePath = filePath.replace(/^[\/\\]/, '');
        const fullPath = path.resolve(storageRoot, relativePath);
        
        logger.debug('Resolved path', { storageRoot, fullPath });

        // Kiểm tra security: file phải nằm trong storage root
        if (!fullPath.startsWith(path.resolve(storageRoot))) {
            logger.warn('Path traversal attempt blocked', { fullPath, ip: getClientIp(req) });
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }

        if (!fs.existsSync(fullPath)) {
            logger.warn('File not found on disk', { fullPath });
            return res.status(404).json({ success: false, message: 'File not found on server' });
        }

        const baseName = path.basename(fullPath);
        // Lấy tên file gốc: nếu có UUID-originalname.ext thì lấy originalname.ext
        const originalFileName = baseName.includes('-') 
            ? baseName.substring(baseName.lastIndexOf('-') + 1) 
            : baseName;
        
        logger.debug('Serving file', { baseName, originalFileName });
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFileName)}"`);

        const stream = fs.createReadStream(fullPath);
        audit.log('DOWNLOAD_OUTGOING_FILE', {
            userId: req.headers['x-user-id'] || null,
            documentId,
            fileName: originalFileName,
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

        const pool = database.getPool();
        
        logger.debug('Download legacy request', { documentId });
        
        const result = await pool.request()
            .input('docId', documentId)
            .query(`SELECT TOP 1 FileID, FileName, ContentType FROM dbo.WF_Incoming_Doc_Files WHERE DocumentID = @docId ORDER BY FileID DESC`);

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'No file found for this document' });
        }

        const fileRec = result.recordset[0];
        const filePath = fileRec.FileName || '';
        const contentType = fileRec.ContentType || 'application/octet-stream';

        logger.debug('Legacy file from DB', { filePath });

        const storageRoot = process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads');

        let relativePath = filePath.replace(/^[\/\\]/, '');
        const fullPath = path.resolve(storageRoot, relativePath);
        
        logger.debug('Resolved path', { storageRoot, fullPath });

        if (!fullPath.startsWith(path.resolve(storageRoot))) {
            logger.warn('Path traversal attempt blocked', { fullPath, ip: getClientIp(req) });
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }

        if (!fs.existsSync(fullPath)) {
            logger.warn('File not found on disk', { fullPath });
            return res.status(404).json({ success: false, message: 'File not found on server' });
        }

        const baseName = path.basename(fullPath);
        // Lấy tên file gốc: nếu có UUID-originalname.ext thì lấy originalname.ext
        const originalFileName = baseName.includes('-') 
            ? baseName.substring(baseName.lastIndexOf('-') + 1) 
            : baseName;
        
        logger.debug('Serving file', { baseName, originalFileName });
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFileName)}"`);

        const stream = fs.createReadStream(fullPath);
        audit.log('DOWNLOAD_INCOMING_FILE', {
            userId: req.headers['x-user-id'] || null,
            documentId,
            fileName: originalFileName,
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

module.exports = router;
