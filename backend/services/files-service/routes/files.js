const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const database = require('../../../shared/config/database');
const sql = database.sql;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Download file cho Incoming Documents
router.get('/download/incoming/:documentId', async (req, res) => {
    try {
        const documentId = parseInt(req.params.documentId, 10);
        if (isNaN(documentId)) {
            return res.status(400).json({ success: false, message: 'Invalid documentId' });
        }

        const pool = database.getPool();
        
        console.log('🔍 [Download Incoming] DocumentID:', documentId);
        
        const result = await pool.request()
            .input('docId', documentId)
            .query(`SELECT TOP 1 FileID, FileName, ContentType FROM dbo.WF_Incoming_Doc_Files WHERE DocumentID = @docId ORDER BY FileID DESC`);

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'No file found for this document' });
        }

        const fileRec = result.recordset[0];
        const filePath = fileRec.FileName || '';
        const contentType = fileRec.ContentType || 'application/octet-stream';

        console.log('📁 [Download Incoming] FileName from DB:', filePath);

        const storageRoot = process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads');

        // Normalize Windows backslashes to forward slashes (Linux compatibility)
        const normalizedIncoming = filePath.replace(/\\/g, '/');
        // Strip Windows drive letter (e.g. "D:/folder") or leading slash
        let relativePath;
        if (/^[A-Za-z]:\//.test(normalizedIncoming)) {
            relativePath = normalizedIncoming.replace(/^[A-Za-z]:\//, '');
        } else {
            relativePath = normalizedIncoming.replace(/^\//, '');
        }
        const fullPath = path.resolve(storageRoot, relativePath);
        
        console.log('📂 Storage Root:', storageRoot);
        console.log('📂 Full Path:', fullPath);

        // Kiểm tra security: file phải nằm trong storage root
        if (!fullPath.startsWith(path.resolve(storageRoot))) {
            console.warn('Attempt to access file outside storage root:', fullPath);
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }

        if (!fs.existsSync(fullPath)) {
            console.warn('Requested file not found on disk:', fullPath);
            return res.status(404).json({ success: false, message: 'File not found on server' });
        }

        const baseName = path.basename(fullPath);
        // Lấy tên file gốc: nếu có UUID-originalname.ext thì lấy originalname.ext
        const originalFileName = baseName.includes('-') 
            ? baseName.substring(baseName.lastIndexOf('-') + 1) 
            : baseName;
        
        console.log('📄 Base Name:', baseName);
        console.log('📄 Original File Name:', originalFileName);
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFileName)}"`);

        const stream = fs.createReadStream(fullPath);
        stream.pipe(res);
        stream.on('error', (err) => {
            console.error('File stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Error streaming file' });
            }
        });
    } catch (error) {
        console.error('Error in incoming file download route:', error);
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
        
        console.log('🔍 [Download Outgoing] DocumentID:', documentId);
        
        const result = await pool.request()
            .input('docId', documentId)
            .query(`SELECT TOP 1 FileID, FileName, ContentType FROM dbo.WF_Outgoing_Doc_Files WHERE DocumentID = @docId ORDER BY FileID DESC`);

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'No file found for this document' });
        }

        const fileRec = result.recordset[0];
        const filePath = fileRec.FileName || '';
        const contentType = fileRec.ContentType || 'application/octet-stream';

        console.log('📁 [Download Outgoing] FileName from DB:', filePath);

        const storageRoot = process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads');

        // Normalize Windows backslashes to forward slashes (Linux compatibility)
        const normalizedOutgoing = filePath.replace(/\\/g, '/');
        // Strip Windows drive letter (e.g. "D:/folder") or leading slash
        let relativePath;
        if (/^[A-Za-z]:\//.test(normalizedOutgoing)) {
            relativePath = normalizedOutgoing.replace(/^[A-Za-z]:\//, '');
        } else {
            relativePath = normalizedOutgoing.replace(/^\//, '');
        }
        const fullPath = path.resolve(storageRoot, relativePath);
        
        console.log('📂 Storage Root:', storageRoot);
        console.log('📂 Full Path:', fullPath);

        // Kiểm tra security: file phải nằm trong storage root
        if (!fullPath.startsWith(path.resolve(storageRoot))) {
            console.warn('Attempt to access file outside storage root:', fullPath);
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }

        if (!fs.existsSync(fullPath)) {
            console.warn('Requested file not found on disk:', fullPath);
            return res.status(404).json({ success: false, message: 'File not found on server' });
        }

        const baseName = path.basename(fullPath);
        // Lấy tên file gốc: nếu có UUID-originalname.ext thì lấy originalname.ext
        const originalFileName = baseName.includes('-') 
            ? baseName.substring(baseName.lastIndexOf('-') + 1) 
            : baseName;
        
        console.log('📄 Base Name:', baseName);
        console.log('📄 Original File Name:', originalFileName);
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFileName)}"`);

        const stream = fs.createReadStream(fullPath);
        stream.pipe(res);
        stream.on('error', (err) => {
            console.error('File stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Error streaming file' });
            }
        });
    } catch (error) {
        console.error('Error in outgoing file download route:', error);
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
        
        console.log('🔍 [Download Legacy] DocumentID:', documentId);
        
        const result = await pool.request()
            .input('docId', documentId)
            .query(`SELECT TOP 1 FileID, FileName, ContentType FROM dbo.WF_Incoming_Doc_Files WHERE DocumentID = @docId ORDER BY FileID DESC`);

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'No file found for this document' });
        }

        const fileRec = result.recordset[0];
        const filePath = fileRec.FileName || '';
        const contentType = fileRec.ContentType || 'application/octet-stream';

        console.log('📁 [Download Legacy] FileName from DB:', filePath);

        const storageRoot = process.env.FILE_STORAGE_ROOT || path.join(__dirname, '..', 'uploads');

        // Normalize Windows backslashes to forward slashes (Linux compatibility)
        const normalizedLegacy = filePath.replace(/\\/g, '/');
        // Strip Windows drive letter (e.g. "D:/folder") or leading slash
        let relativePath;
        if (/^[A-Za-z]:\//.test(normalizedLegacy)) {
            relativePath = normalizedLegacy.replace(/^[A-Za-z]:\//, '');
        } else {
            relativePath = normalizedLegacy.replace(/^\//, '');
        }

        const fullPath = path.resolve(storageRoot, relativePath);
        
        console.log('📂 Storage Root:', storageRoot);
        console.log('📂 Full Path:', fullPath);

        if (!fullPath.startsWith(path.resolve(storageRoot))) {
            console.warn('Attempt to access file outside storage root:', fullPath);
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }

        if (!fs.existsSync(fullPath)) {
            console.warn('Requested file not found on disk:', fullPath);
            return res.status(404).json({ success: false, message: 'File not found on server' });
        }

        const baseName = path.basename(fullPath);
        // Lấy tên file gốc: nếu có UUID-originalname.ext thì lấy originalname.ext
        const originalFileName = baseName.includes('-') 
            ? baseName.substring(baseName.lastIndexOf('-') + 1) 
            : baseName;
        
        console.log('📄 Base Name:', baseName);
        console.log('📄 Original File Name:', originalFileName);
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFileName)}"`);

        const stream = fs.createReadStream(fullPath);
        stream.pipe(res);
        stream.on('error', (err) => {
            console.error('File stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Error streaming file' });
            }
        });
    } catch (error) {
        console.error('Error in file download route:', error);
        res.status(500).json({ success: false, message: 'Server error', error: IS_PRODUCTION ? 'Internal server error' : error.message });
    }
});

module.exports = router;
