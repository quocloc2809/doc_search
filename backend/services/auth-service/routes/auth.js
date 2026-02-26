const express = require('express');
const router = express.Router();
const sql = require('mssql');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const database = require('../../../shared/config/database');

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
                    Role
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
                role: user.Role
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
