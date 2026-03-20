const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const database = require('../../../shared/config/database');
const sql = database.sql;

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Helper function to hash password with salt
function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// Helper function to generate salt
function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Tên đăng nhập và mật khẩu là bắt buộc'
            });
        }

        if (IS_PRODUCTION && !JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'Authentication is not configured'
            });
        }

        const pool = database.getPool();
        const result = await pool.request()
            .input('username', username)
            .query(`
                SELECT 
                    UserID, 
                    Username, 
                    PasswordHash, 
                    Salt, 
                    FullName, 
                    Email,
                    IsActive,
                    Role,
                    GroupID
                FROM dbo.Users 
                WHERE Username = @username
            `);

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Tên đăng nhập hoặc mật khẩu không đúng'
            });
        }

        const user = result.recordset[0];

        if (!user.IsActive) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản đã bị vô hiệu hóa'
            });
        }

        const hashedPassword = hashPassword(password, user.Salt);
        if (hashedPassword !== user.PasswordHash) {
            return res.status(401).json({
                success: false,
                message: 'Tên đăng nhập hoặc mật khẩu không đúng'
            });
        }

        await pool.request()
            .input('userId', user.UserID)
            .query(`UPDATE dbo.Users SET LastLoginDate = GETDATE() WHERE UserID = @userId`);

        const token = jwt.sign(
            {
                userId: user.UserID,
                username: user.Username,
                role: user.Role,
                groupId: user.GroupID || null
            },
            JWT_SECRET || 'development-unsafe-secret',
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            message: 'Đăng nhập thành công',
            data: {
                userId: user.UserID,
                username: user.Username,
                fullName: user.FullName,
                email: user.Email,
                role: user.Role,
                groupId: user.GroupID || null,
                accessToken: token,
                tokenType: 'Bearer',
                expiresIn: JWT_EXPIRES_IN
            }
        });

    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message
        });
    }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, password, fullName, email, role } = req.body;

        if (!username || !password || !fullName) {
            return res.status(400).json({
                success: false,
                message: 'Tên đăng nhập, mật khẩu và họ tên là bắt buộc'
            });
        }

        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu phải có tối thiểu 8 ký tự'
            });
        }

        const pool = database.getPool();

        const checkResult = await pool.request()
            .input('username', sql.NVarChar(50), username)
            .query('SELECT UserID FROM dbo.Users WHERE Username = @username');

        if (checkResult.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Tên đăng nhập đã tồn tại'
            });
        }

        const salt = generateSalt();
        const passwordHash = hashPassword(password, salt);

        const result = await pool.request()
            .input('username', sql.NVarChar(50), username)
            .input('passwordHash', sql.NVarChar(200), passwordHash)
            .input('salt', sql.NVarChar(50), salt)
            .input('fullName', sql.NVarChar(100), fullName)
            .input('email', sql.NVarChar(100), email || null)
            .input('role', sql.NVarChar(20), role || 'user')
            .query(`
                INSERT INTO dbo.Users (Username, PasswordHash, Salt, FullName, Email, Role, IsActive, CreatedDate)
                VALUES (@username, @passwordHash, @salt, @fullName, @email, @role, 1, GETDATE());
                SELECT SCOPE_IDENTITY() AS UserID;
            `);

        const newUserId = result.recordset[0].UserID;

        res.status(201).json({
            success: true,
            message: 'Tạo tài khoản thành công',
            data: {
                userId: newUserId,
                username: username,
                fullName: fullName
            }
        });

    } catch (error) {
        console.error('Lỗi tạo tài khoản:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message
        });
    }
});

// Middleware: verify JWT and require admin role
function requireAdmin(req, res, next) {
    const JWT_SECRET = process.env.JWT_SECRET || '';
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const decoded = require('jsonwebtoken').verify(token, JWT_SECRET || 'development-unsafe-secret');
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: Yêu cầu quyền admin' });
        }
        req.user = decoded;
        return next();
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
}

// GET /api/auth/admin/users - Lấy danh sách tất cả tài khoản
router.get('/admin/users', requireAdmin, async (req, res) => {
    try {
        const pool = database.getPool();
        const result = await pool.request().query(`
            SELECT u.UserID, u.Username, u.FullName, u.Email, u.Role, u.IsActive,
                   u.CreatedDate, u.LastLoginDate, u.GroupID,
                   COALESCE(g.RecursiveGroupName, '') AS GroupName
            FROM dbo.Users u
            LEFT JOIN dbo.Core_Groups g ON g.GroupID = u.GroupID AND g.IsView = 0 AND g.IsShow = 1
            ORDER BY u.CreatedDate DESC
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Lỗi lấy danh sách tài khoản:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: IS_PRODUCTION ? 'Internal server error' : error.message });
    }
});

// POST /api/auth/admin/users - Tạo tài khoản mới (admin)
router.post('/admin/users', requireAdmin, async (req, res) => {
    try {
        const { username, password, fullName, email, role, groupId } = req.body;

        if (!username || !password || !fullName) {
            return res.status(400).json({ success: false, message: 'Tên đăng nhập, mật khẩu và họ tên là bắt buộc' });
        }

        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ success: false, message: 'Mật khẩu phải có tối thiểu 8 ký tự' });
        }

        const validRoles = ['admin', 'user'];
        const assignedRole = validRoles.includes(role) ? role : 'user';
        const assignedGroupId = groupId ? parseInt(groupId, 10) : null;
        if (assignedGroupId !== null && !Number.isFinite(assignedGroupId)) {
            return res.status(400).json({ success: false, message: 'GroupID không hợp lệ' });
        }

        const pool = database.getPool();
        const checkResult = await pool.request()
            .input('username', sql.NVarChar(50), username)
            .query('SELECT UserID FROM dbo.Users WHERE Username = @username');

        if (checkResult.recordset.length > 0) {
            return res.status(409).json({ success: false, message: 'Tên đăng nhập đã tồn tại' });
        }

        const salt = generateSalt();
        const passwordHash = hashPassword(password, salt);

        const result = await pool.request()
            .input('username', sql.NVarChar(50), username)
            .input('passwordHash', sql.NVarChar(200), passwordHash)
            .input('salt', sql.NVarChar(50), salt)
            .input('fullName', sql.NVarChar(100), fullName)
            .input('email', sql.NVarChar(100), email || null)
            .input('role', sql.NVarChar(20), assignedRole)
            .input('groupId', sql.Int, assignedGroupId)
            .query(`
                INSERT INTO dbo.Users (Username, PasswordHash, Salt, FullName, Email, Role, GroupID, IsActive, CreatedDate)
                VALUES (@username, @passwordHash, @salt, @fullName, @email, @role, @groupId, 1, GETDATE());
                SELECT SCOPE_IDENTITY() AS UserID;
            `);

        res.status(201).json({ success: true, message: 'Tạo tài khoản thành công', data: { userId: result.recordset[0].UserID, username, fullName } });
    } catch (error) {
        console.error('Lỗi tạo tài khoản admin:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: IS_PRODUCTION ? 'Internal server error' : error.message });
    }
});

// PUT /api/auth/admin/users/:id - Cập nhật tài khoản
router.put('/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ success: false, message: 'ID tài khoản không hợp lệ' });
        }

        const { fullName, email, role, isActive, newPassword, groupId } = req.body;

        if (!fullName) {
            return res.status(400).json({ success: false, message: 'Họ tên là bắt buộc' });
        }

        const validRoles = ['admin', 'user'];
        const assignedRole = validRoles.includes(role) ? role : 'user';
        const assignedGroupId = groupId ? parseInt(groupId, 10) : null;
        if (assignedGroupId !== null && !Number.isFinite(assignedGroupId)) {
            return res.status(400).json({ success: false, message: 'GroupID không hợp lệ' });
        }

        const pool = database.getPool();

        const checkResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT UserID FROM dbo.Users WHERE UserID = @userId');

        if (checkResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }

        if (newPassword) {
            if (typeof newPassword !== 'string' || newPassword.length < 8) {
                return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có tối thiểu 8 ký tự' });
            }
            const newSalt = generateSalt();
            const newPasswordHash = hashPassword(newPassword, newSalt);
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('fullName', sql.NVarChar(100), fullName)
                .input('email', sql.NVarChar(100), email || null)
                .input('role', sql.NVarChar(20), assignedRole)
                .input('isActive', sql.Bit, isActive !== false ? 1 : 0)
                .input('groupId', sql.Int, assignedGroupId)
                .input('passwordHash', sql.NVarChar(200), newPasswordHash)
                .input('salt', sql.NVarChar(50), newSalt)
                .query(`
                    UPDATE dbo.Users
                    SET FullName = @fullName, Email = @email, Role = @role, IsActive = @isActive,
                        GroupID = @groupId, PasswordHash = @passwordHash, Salt = @salt, UpdatedDate = GETDATE()
                    WHERE UserID = @userId
                `);
        } else {
            await pool.request()
                .input('userId', sql.Int, userId)
                .input('fullName', sql.NVarChar(100), fullName)
                .input('email', sql.NVarChar(100), email || null)
                .input('role', sql.NVarChar(20), assignedRole)
                .input('isActive', sql.Bit, isActive !== false ? 1 : 0)
                .input('groupId', sql.Int, assignedGroupId)
                .query(`
                    UPDATE dbo.Users
                    SET FullName = @fullName, Email = @email, Role = @role, IsActive = @isActive,
                        GroupID = @groupId, UpdatedDate = GETDATE()
                    WHERE UserID = @userId
                `);
        }

        res.json({ success: true, message: 'Cập nhật tài khoản thành công' });
    } catch (error) {
        console.error('Lỗi cập nhật tài khoản:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: IS_PRODUCTION ? 'Internal server error' : error.message });
    }
});

// DELETE /api/auth/admin/users/:id - Xoá tài khoản
router.delete('/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(400).json({ success: false, message: 'ID tài khoản không hợp lệ' });
        }

        // Prevent admin from deleting their own account
        if (req.user && req.user.userId === userId) {
            return res.status(400).json({ success: false, message: 'Không thể xoá tài khoản đang đăng nhập' });
        }

        const pool = database.getPool();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('DELETE FROM dbo.Users WHERE UserID = @userId');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }

        res.json({ success: true, message: 'Xoá tài khoản thành công' });
    } catch (error) {
        console.error('Lỗi xoá tài khoản:', error);
        // Foreign key / reference constraint
        if (error && (error.number === 547 || (error.message && error.message.includes('REFERENCE')))) {
            return res.status(409).json({ success: false, message: 'Không thể xoá tài khoản vì đang được tham chiếu bởi dữ liệu khác trong hệ thống.' });
        }
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
});

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
    try {
        const { userId, oldPassword, newPassword } = req.body;

        if (!userId || !oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc'
            });
        }

        if (typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu mới phải có tối thiểu 8 ký tự'
            });
        }

        const pool = database.getPool();

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT PasswordHash, Salt FROM dbo.Users WHERE UserID = @userId');

        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }

        const user = result.recordset[0];

        const oldHashedPassword = hashPassword(oldPassword, user.Salt);
        if (oldHashedPassword !== user.PasswordHash) {
            return res.status(401).json({
                success: false,
                message: 'Mật khẩu cũ không đúng'
            });
        }

        const newSalt = generateSalt();
        const newPasswordHash = hashPassword(newPassword, newSalt);

        await pool.request()
            .input('userId', sql.Int, userId)
            .input('passwordHash', sql.NVarChar(200), newPasswordHash)
            .input('salt', sql.NVarChar(50), newSalt)
            .query(`
                UPDATE dbo.Users 
                SET PasswordHash = @passwordHash, Salt = @salt, UpdatedDate = GETDATE()
                WHERE UserID = @userId
            `);

        res.json({
            success: true,
            message: 'Đổi mật khẩu thành công'
        });

    } catch (error) {
        console.error('Lỗi đổi mật khẩu:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: IS_PRODUCTION ? 'Internal server error' : error.message
        });
    }
});

module.exports = router;
