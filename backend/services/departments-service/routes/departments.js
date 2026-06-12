const express = require('express');
const router = express.Router();
const database = require('../../../shared/config/database');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const createLogger = require('../../../shared/utils/logger');
const logger = createLogger('departments');

router.get('/portals', async (req, res) => {
    try {
        const pool = database.getPool();

        const result = await pool.request().query(`
            SELECT
                PortalId AS GroupID,
                PortalName AS GroupName
            FROM dbo.Core_Portals
            WHERE PortalId IS NOT NULL
                AND PortalName IS NOT NULL
                AND LTRIM(RTRIM(PortalName)) <> ''
            ORDER BY PortalId
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        logger.error('Lỗi lấy danh sách portal', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message
        });
    }
});

router.get('/', async (req, res) => {
    try {
        const pool = database.getPool();

        const result = await pool.request().query(`
            SELECT
                GroupID,
                GroupName
            FROM dbo.Core_Groups
            WHERE GroupID IS NOT NULL
                AND GroupName IS NOT NULL
                AND LTRIM(RTRIM(GroupName)) <> ''
                AND IsView = 0
                AND IsShow = 1
            ORDER BY GroupName
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        logger.error('Lỗi lấy danh sách đơn vị', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message
        });
    }
});

module.exports = router;