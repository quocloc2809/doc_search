const express = require('express');
const router = express.Router();
const database = require('../../../shared/config/database');
const sql = database.sql;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const createLogger = require('../../../shared/utils/logger');
const logger = createLogger('documents');

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
            whereClause = 'WHERE doc.AssignedGroupID = @groupId';
        }

        const result = await request.query(`
            SELECT
                doc.DocumentID,
                doc.DocumentNo,
                doc.CreatedDate,
                doc.DocumentSummary,
                doc.UpdatedDate,
                doc.ExpiredDate,
                doc.Status,
                doc.AssignedGroupID,
                doc.AssignedReviewedUserID,
                doc.CompletedDate,
                doc.ReviewNote,
                CASE
                    WHEN doc.AssignedGroupID > 0 THEN COALESCE(grp.RecursiveGroupName, '')
                    WHEN doc.AssignedGroupID < 0 THEN COALESCE(portal.PortalName, '')
                    ELSE ''
                END AS GroupName,
                NULLIF(LTRIM(RTRIM(COALESCE(usr.Lastname, '') + ' ' + COALESCE(usr.FirstName, ''))), '') as LeaderName
            FROM dbo.WF_Incoming_Docs doc
            LEFT JOIN dbo.Core_Groups grp ON doc.AssignedGroupID > 0 AND grp.GroupID = doc.AssignedGroupID AND grp.IsView = 0 AND grp.IsShow = 1
            LEFT JOIN dbo.Core_Portals portal ON doc.AssignedGroupID < 0 AND portal.PortalId = ABS(doc.AssignedGroupID)
            LEFT JOIN dbo.Core_Users usr ON usr.UserID = doc.AssignedReviewedUserID
            ${whereClause}
            ORDER BY doc.CreatedDate DESC, doc.DocumentID DESC
        `);

        const rows = result.recordset || [];

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
        const pool = database.getPool();

        const result = await pool.request().input('id', sql.Int, id).query(`
            SELECT
              doc.DocumentID,
              doc.DocumentNo,
              doc.ReceivedDate,
              doc.DocumentSummary,
              doc.issuedOrganizationName2,
              CASE
                    WHEN doc.AssignedGroupID > 0 THEN COALESCE(grp.RecursiveGroupName, '')
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

        logger.debug('Incoming document detail', { id, documentId: result.recordset[0]?.DocumentID });

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy công văn đến',
            });
        }
        res.json({
            success: true,
            data: result.recordset[0],
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
