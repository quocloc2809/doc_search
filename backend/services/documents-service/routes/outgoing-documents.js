const express = require('express');
const router = express.Router();
const database = require('../../../shared/config/database');
const sql = database.sql;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const createLogger = require('../../../shared/utils/logger');
const logger = createLogger('documents');

function sortByCreatedDateDescThenIdDesc(a, b) {
    const aTime = a?.CreatedDate ? new Date(a.CreatedDate).getTime() : 0;
    const bTime = b?.CreatedDate ? new Date(b.CreatedDate).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    const aId = Number(a?.DocumentID || 0);
    const bId = Number(b?.DocumentID || 0);
    return bId - aId;
}

async function queryOutgoingList(pool, { hasGroupFilter, groupIdNum, year, sql }) {
    const request = pool.request();
    const conditions = [];
    if (hasGroupFilter) {
        request.input('groupId', sql.Int, groupIdNum);
        // Match consistently even if IssuedGroupID is negative (portal).
        conditions.push('ABS(doc.IssuedGroupID) = @groupId');
    }

    if (year && Number.isFinite(Number(year))) {
        const y = Number(year);
        const start = new Date(y, 0, 1);
        const end = new Date(y + 1, 0, 1);
        request.input('startDate', sql.DateTime2, start);
        request.input('endDate', sql.DateTime2, end);
        // Legacy/archived DBs may not populate CreatedDate reliably; fallback to SignedDate.
        // Avoid COALESCE() in WHERE for performance.
        conditions.push(`(
            (doc.CreatedDate >= @startDate AND doc.CreatedDate < @endDate)
            OR
            (doc.CreatedDate IS NULL AND doc.SignedDate >= @startDate AND doc.SignedDate < @endDate)
        )`);
    }

    const result = await request.query(`
        SELECT
            doc.DocumentID,
            doc.DocumentNo,
            COALESCE(doc.CreatedDate, doc.SignedDate) AS CreatedDate,
            doc.DocumentSummary,
            doc.SignedDate,
            doc.SignerPosition,                
            doc.IssuedGroupID,                
            NULLIF(LTRIM(RTRIM(COALESCE(usr.Lastname, '') + ' ' + COALESCE(usr.FirstName, ''))), '') as SignerFullname,
            CASE
                WHEN doc.IssuedGroupID > 0 THEN COALESCE(g.RecursiveGroupName, '')
                WHEN doc.IssuedGroupID < 0 THEN COALESCE(portal.PortalName, '')
                ELSE ''
            END AS GroupName
        FROM dbo.WF_Outgoing_Docs doc
        LEFT JOIN dbo.Core_Users usr ON usr.UserID = doc.SignedUserID
        LEFT JOIN dbo.Core_Groups g ON doc.IssuedGroupID > 0 AND g.GroupID = doc.IssuedGroupID AND g.IsView = 0 AND g.IsShow = 1
        LEFT JOIN dbo.Core_Portals portal ON doc.IssuedGroupID < 0 AND portal.PortalId = ABS(doc.IssuedGroupID)
        ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
        ORDER BY COALESCE(doc.CreatedDate, doc.SignedDate) DESC, doc.DocumentID DESC
    `);

    return result.recordset || [];
}

// Get all outgoing documents (similar structure to incoming documents)
router.get('/', async (req, res) => {
    try {
        const rawYear = (req.query.year || '').toString().trim();
        const year = /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
        const sourceKey = year ? database.getDbKeyForYear(rawYear) : database.getPrimaryKey();
        const pool = year ? await database.getPoolForYear(rawYear) : database.getPool();

        const userRole = (req.headers['x-user-role'] || '').toString().toLowerCase();
        const userGroupId = req.headers['x-user-group-id'] || '';
        const groupIdNum = parseInt(userGroupId, 10);
        const isAdmin = userRole === 'admin';
        const hasGroupFilter =
            !isAdmin && Number.isFinite(groupIdNum) && groupIdNum !== 0;

        res.json({
            success: true,
            data: (await queryOutgoingList(pool, { hasGroupFilter, groupIdNum, year, sql }))
                .map((r) => ({ ...r, SourceDb: sourceKey }))
                .sort(sortByCreatedDateDescThenIdDesc),
        });
    } catch (error) {
        logger.error('Lỗi lấy danh sách outgoing documents', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message,
        });
    }
});

// Search must be declared BEFORE '/:id' to avoid being captured as an id.
router.get('/search', async (req, res) => {
    try {
        const rawYear = (req.query.year || '').toString().trim();
        const year = /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
        const sourceKey = year ? database.getDbKeyForYear(rawYear) : database.getPrimaryKey();
        const pool = year ? await database.getPoolForYear(rawYear) : database.getPool();
        const { q } = req.query;

        const querySearch = async (pool, sourceKey) => {
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
            return (result.recordset || []).map((r) => ({ ...r, SourceDb: sourceKey }));
        };

        const merged = (await querySearch(pool, sourceKey))
            .sort(sortByCreatedDateDescThenIdDesc)
            .slice(0, 50);

        res.json({
            success: true,
            data: merged,
        });
    } catch (error) {
        logger.error('Lỗi tìm kiếm outgoing documents', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message,
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const primaryKey = database.getPrimaryKey();
        const db2020Key = database.get2020Key();
        const dbKey = (req.query.db || '').toString().trim();
        const rawYear = (req.query.year || '').toString().trim();
        const year = /^\d{4}$/.test(rawYear) ? rawYear : null;
        const { id } = req.params;

        let pool = null;
        let sourceDb = primaryKey;

        if (dbKey) {
            pool = await database.getPoolByDbKey(dbKey);
            sourceDb = dbKey;
        } else if (year) {
            pool = await database.getPoolForYear(year);
            sourceDb = database.getDbKeyForYear(year);
        } else {
            pool = database.getPool(primaryKey);
            sourceDb = primaryKey;
        }

        const queryDetail = async (pool) =>
            pool.request().input('id', sql.Int, id).query(`
            SELECT
            doc.DocumentNo,
            doc.CreatedDate,
            doc.DocumentSummary,
            doc.SignedDate,
            doc.SignerPosition,
            doc.IssuedGroupID,
            NULLIF(LTRIM(RTRIM(COALESCE(usr.Lastname, '') + ' ' + COALESCE(usr.FirstName, ''))), '') as SignerFullname,
            CASE
                WHEN doc.IssuedGroupID > 0 THEN COALESCE(g.RecursiveGroupName, '')
                WHEN doc.IssuedGroupID < 0 THEN COALESCE(portal.PortalName, '')
                ELSE ''
            END AS GroupName,
            COALESCE(b.Name, '') as BookName,
            COALESCE(d.Name, '') as TypeName,
            COALESCE(f.FileName, '') as FileName
        FROM dbo.WF_Outgoing_Docs doc
        LEFT JOIN dbo.Core_Users usr ON usr.UserID = doc.SignedUserID
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

        let result = await queryDetail(pool);

        // Back-compat fallback: if client didn't specify db/year, still try the legacy 2020 DB.
        if ((!result.recordset || result.recordset.length === 0) && !dbKey && !year) {
            try {
                const po2020Pool = await database.getPoolByDbKey(db2020Key);
                result = await queryDetail(po2020Pool);
                if (result.recordset && result.recordset.length > 0) {
                    sourceDb = db2020Key;
                }
            } catch {
                // ignore
            }
        }

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy công văn đi',
            });
        }

        res.json({
            success: true,
            data: { ...(result.recordset[0] || {}), SourceDb: sourceDb },
        });
    } catch (error) {
        logger.error('Lỗi lấy chi tiết công văn đi', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message,
        });
    }
});

module.exports = router;
