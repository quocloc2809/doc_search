const express = require('express');
const router = express.Router();
const database = require('../../../shared/config/database');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

router.get('/', async (req, res) => {
    try {
        const pool = database.getPool();

        const result = await pool.request().query(`
            SELECT
                GroupID,
                RecursiveGroupName AS GroupName
            FROM dbo.Core_Groups
            WHERE GroupID IS NOT NULL
                AND RecursiveGroupName IS NOT NULL
                AND LTRIM(RTRIM(RecursiveGroupName)) <> ''
                AND IsView = 0
                AND IsShow = 1
            ORDER BY RecursiveGroupName
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách đơn vị:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message
        });
    }
});

module.exports = router;