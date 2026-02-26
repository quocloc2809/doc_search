const express = require('express');
const router = express.Router();
const sql = require('mssql');
const database = require('../../../shared/config/database');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const COLUMN_SETS = {
    MAIN_VIEW: [
        'DocumentID', 'DocumentNo', 'CreatedDate', 'DocumentSummary', 'UpdatedDate',
        'ExpiredDate', 'AssignedReviewedFullname', 'Status',
        'AssignedGroupID', 'AssignedUserID', 'ReviewNote'
    ],

    DETAIL: '*'
};

router.get('/', async (req, res) => {
    try {
        const pool = database.getPool();

        const view = req.query.view || 'MAIN_VIEW';
        const columns = COLUMN_SETS[view] || COLUMN_SETS.MAIN_VIEW;

        const columnStr = Array.isArray(columns) ? columns.join(', ') : columns;

        const result = await pool.request().query(`
            SELECT
                doc.DocumentID,
                doc.DocumentNo,
                doc.CreatedDate,
                doc.DocumentSummary,
                doc.UpdatedDate,
                doc.ExpiredDate,
                doc.AssignedReviewedFullname,
                doc.Status,
                doc.AssignedGroupID,
                doc.CompletedDate,
                doc.ReviewNote,
                COALESCE(grp.GroupName, '') as GroupName
            FROM dbo.WF_Incoming_Docs doc
            LEFT JOIN dbo.Core_Groups grp ON grp.GroupID = doc.AssignedGroupID
            ORDER BY doc.CreatedDate DESC, doc.DocumentID DESC
        `)

        const rows = result.recordset || [];

        // Leader (lãnh đạo bút phê) logic: use AssignedReviewedFullname
        // If AssignedReviewedFullname is null/empty => chưa bút phê, otherwise đã bút phê.
        const leaderField = 'AssignedReviewedFullname';
        const leaderDone = rows.reduce((acc, r) => {
            const val = r[leaderField] ?? r[leaderField.toLowerCase()] ?? r[leaderField.toUpperCase()];
            return acc + ((val !== null && val !== undefined && String(val).trim() !== '') ? 1 : 0);
        }, 0);
        const leaderUndone = Math.max(0, rows.length - leaderDone);

        // Office logic: use CompletedDate instead of Status
        // If CompletedDate is present => processed; if null/empty => unprocessed
        const processed = rows.reduce((acc, r) => (r.CompletedDate ? acc + 1 : acc), 0);
        const unprocessed = rows.reduce((acc, r) => (!r.CompletedDate ? acc + 1 : acc), 0);

        const statsObj = {
            leader: {
                column: leaderField,
                done: leaderDone,
                undone: leaderUndone,
                total: rows.length
            },
            office: {
                processed: processed,
                unprocessed: unprocessed,
                total: rows.length
            }
        };

        console.log('Computed incoming-documents stats:', statsObj);

        res.json({
            success: true,
            data: rows,
            stats: statsObj,
            view: view,
            columns_used: Array.isArray(columns) ? columns : 'all'
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách công văn:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pool = database.getPool();

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM dbo.WF_Incoming_Docs WHERE DocumentID = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy công văn'
            });
        }

        res.json({
            success: true,
            data: result.recordset[0]
        });
    } catch (error) {
        console.error('Lỗi lấy thông tin công văn:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message
        });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { ReviewNote, OutgoingDocs } = req.body;

        const pool = database.getPool();

        const checkResult = await pool.request()
            .input('checkId', sql.Int, id)
            .query('SELECT DocumentID FROM dbo.WF_Incoming_Docs WHERE DocumentID = @checkId');

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy công văn để cập nhật',
                documentId: id
            });
        }

        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('reviewNote', sql.NVarChar(sql.MAX), ReviewNote || '')
            .input('outgoingDocs', sql.NVarChar(50), OutgoingDocs || null)
            .query(`
                UPDATE dbo.WF_Incoming_Docs SET
                    /* Status is 1 when there's an outgoing document OR a non-empty review note */
                    Status = CASE WHEN ( (@outgoingDocs IS NOT NULL AND LTRIM(RTRIM(@outgoingDocs)) <> '') OR ( @reviewNote IS NOT NULL AND LTRIM(RTRIM(@reviewNote)) <> '' ) ) THEN 1 ELSE 0 END,
                    ReviewNote = @reviewNote,
                    OutgoingDocs = @outgoingDocs,
                    UpdatedDate = GETDATE(),
                    /* CompletedDate ONLY set when there's an outgoing document */
                    CompletedDate = CASE WHEN (@outgoingDocs IS NOT NULL AND LTRIM(RTRIM(@outgoingDocs)) <> '') THEN COALESCE(CompletedDate, GETDATE()) ELSE NULL END
                WHERE DocumentID = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy công văn để cập nhật'
            });
        }

        // Return updated fields (including CompletedDate)
        const updated = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT Status, ReviewNote, OutgoingDocs, CompletedDate FROM dbo.WF_Incoming_Docs WHERE DocumentID = @id');

        res.json({
            success: true,
            message: 'Cập nhật công văn thành công',
            data: updated.recordset[0] || {
                Status: null,
                ReviewNote: ReviewNote || '',
                OutgoingDocs: OutgoingDocs || null
            }
        });
    } catch (error) {
        console.error('Lỗi cập nhật công văn:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message
        });
    }
});

module.exports = router;