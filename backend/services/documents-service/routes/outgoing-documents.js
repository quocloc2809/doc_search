const express = require('express');
const router = express.Router();
const database = require('../../../shared/config/database');
const sql = database.sql;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Get all outgoing documents (similar structure to incoming documents)
router.get('/', async (req, res) => {
    try {
        const pool = database.getPool();

        const userRole = req.headers['x-user-role'] || '';
        const userGroupId = req.headers['x-user-group-id'] || '';
        const groupIdNum = parseInt(userGroupId, 10);
        const isAdmin = userRole === 'admin';
        const hasGroupFilter =
            !isAdmin && Number.isFinite(groupIdNum) && groupIdNum !== 0;

        const request = pool.request();
        let whereClause = '';
        if (hasGroupFilter) {
            request.input('groupId', sql.Int, groupIdNum);
            whereClause = 'WHERE doc.IssuedGroupID = @groupId';
        }

        const result = await request.query(`
            SELECT
                doc.DocumentID,
                doc.DocumentNo,
                doc.CreatedDate,
                doc.DocumentSummary,
                doc.SignedDate,
                doc.SignerPosition,                
                doc.IssuedGroupID,                
                COALESCE(u.Fullname, '') as SignerFullname,
                CASE
                    WHEN doc.IssuedGroupID > 0 THEN COALESCE(g.RecursiveGroupName, '')
                    WHEN doc.IssuedGroupID < 0 THEN COALESCE(portal.PortalName, '')
                    ELSE ''
                END AS GroupName
            FROM dbo.WF_Outgoing_Docs doc
            LEFT JOIN dbo.Core_Users u ON u.UserID = doc.SignedUserID
            LEFT JOIN dbo.Core_Groups g ON doc.IssuedGroupID > 0 AND g.GroupID = doc.IssuedGroupID AND g.IsView = 0 AND g.IsShow = 1
            LEFT JOIN dbo.Core_Portals portal ON doc.IssuedGroupID < 0 AND portal.PortalId = ABS(doc.IssuedGroupID)
            ${whereClause}
            ORDER BY doc.CreatedDate DESC, doc.DocumentID DESC
        `);

        res.json({
            success: true,
            data: result.recordset || [],
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách outgoing documents:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message,
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const pool = database.getPool();
        const { id } = req.params;

        const result = await pool.request().input('id', sql.Int, id).query(`
            SELECT
            doc.DocumentNo,
            doc.CreatedDate,
            doc.DocumentSummary,
            doc.SignedDate,
            doc.SignerPosition,
            doc.IssuedGroupID,
            COALESCE(u.Fullname, '') as SignerFullname,
            CASE
                WHEN doc.IssuedGroupID > 0 THEN COALESCE(g.RecursiveGroupName, '')
                WHEN doc.IssuedGroupID < 0 THEN COALESCE(portal.PortalName, '')
                ELSE ''
            END AS GroupName,
            COALESCE(b.Name, '') as BookName,
            COALESCE(d.Name, '') as TypeName,
            COALESCE(f.FileName, '') as FileName
        FROM dbo.WF_Outgoing_Docs doc
        LEFT JOIN dbo.Core_Users u ON u.UserID = doc.SignedUserID
        LEFT JOIN dbo.Core_Groups g ON doc.IssuedGroupID > 0 AND g.GroupID = doc.IssuedGroupID
        LEFT JOIN dbo.Core_Portals portal ON doc.IssuedGroupID < 0 AND portal.PortalId = ABS(doc.IssuedGroupID)
        LEFT JOIN dbo.WF_Books b ON b.BookID = doc.BookID
        LEFT JOIN dbo.WF_Doc_Types d ON d.TypeID = doc.TypeID
        LEFT JOIN (
            SELECT DocumentID, FileName, FileID,
                ROW_NUMBER() OVER (PARTITION BY DocumentID ORDER BY CreatedDate DESC) as rn
            FROM dbo.WF_Outgoing_Doc_Files
        ) f ON f.DocumentID = doc.DocumentID AND f.rn = 1 
        WHERE doc.DocumentID = @id
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy công văn đi',
            });
        }

        res.json({
            success: true,
            data: result.recordset[0] || {},
        });
    } catch (error) {
        console.error('Lỗi lấy chi tiết công văn đi:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message,
        });
    }
});

router.get('/search', async (req, res) => {
    try {
        const pool = database.getPool();
        const { q } = req.query;

        let query = `
            SELECT TOP (50)
                DocumentID,
                DocumentNo,
                CreatedDate
            FROM dbo.WF_Outgoing_Docs
            WHERE 1=1
        `;

        const request = pool.request();

        if (q && q.trim()) {
            query += ` AND DocumentNo LIKE @searchTerm`;
            request.input('searchTerm', sql.NVarChar, `%${q.trim()}%`);
        }

        query += ` ORDER BY CreatedDate DESC, DocumentID DESC`;

        const result = await request.query(query);

        res.json({
            success: true,
            data: result.recordset,
        });
    } catch (error) {
        console.error('Lỗi tìm kiếm outgoing documents:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message,
        });
    }
});

module.exports = router;
