// Script để tạo tài khoản mặc định
// Chạy: node create-default-users.js

require('dotenv').config();
const database = require('./shared/config/database');
const sql = require('mssql');
const crypto = require('crypto');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ALLOW_INSECURE_DEFAULT_USERS = process.env.ALLOW_INSECURE_DEFAULT_USERS === 'true';

function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

async function createDefaultUsers() {
    try {
        if (IS_PRODUCTION && !ALLOW_INSECURE_DEFAULT_USERS) {
            throw new Error('Script bị chặn ở production. Set ALLOW_INSECURE_DEFAULT_USERS=true nếu thực sự cần chạy.');
        }

        const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
        const userUsername = process.env.DEFAULT_USER1_USERNAME || 'user1';
        const userPassword = process.env.DEFAULT_USER1_PASSWORD || 'User@123';

        if ((adminPassword === 'Admin@123' || userPassword === 'User@123') && IS_PRODUCTION) {
            throw new Error('Không được dùng mật khẩu mặc định ở production. Hãy set DEFAULT_ADMIN_PASSWORD và DEFAULT_USER1_PASSWORD.');
        }

        await database.connect();
        const pool = database.getPool();

        console.log('Đang tạo tài khoản mặc định...\n');

        // Tài khoản admin
        const adminSalt = generateSalt();
        const adminHash = hashPassword(adminPassword, adminSalt);

        const adminResult = await pool.request()
            .input('username', adminUsername)
            .input('passwordHash', adminHash)
            .input('salt', adminSalt)
            .input('fullName', 'Quản trị viên')
            .input('email', 'admin@example.com')
            .input('role', 'admin')
            .query(`
                IF NOT EXISTS (SELECT * FROM dbo.Users WHERE Username = @username)
                BEGIN
                    INSERT INTO dbo.Users (Username, PasswordHash, Salt, FullName, Email, Role, IsActive, CreatedDate)
                    VALUES (@username, @passwordHash, @salt, @fullName, @email, @role, 1, GETDATE())
                    SELECT 'CREATED' as Status
                END
                ELSE
                BEGIN
                    SELECT 'EXISTS' as Status
                END
            `);

        if (adminResult.recordset[0].Status === 'CREATED') {
            console.log('✅ Đã tạo tài khoản admin:');
            console.log(`   Username: ${adminUsername}`);
            console.log(`   Password: ${adminPassword}`);
            console.log('   Role: admin\n');
        } else {
            console.log('⚠️  Tài khoản admin đã tồn tại\n');
        }

        // Tài khoản user1
        const userSalt = generateSalt();
        const userHash = hashPassword(userPassword, userSalt);

        const userResult = await pool.request()
            .input('username', userUsername)
            .input('passwordHash', userHash)
            .input('salt', userSalt)
            .input('fullName', 'Người dùng 1')
            .input('email', 'user1@example.com')
            .input('role', 'user')
            .query(`
                IF NOT EXISTS (SELECT * FROM dbo.Users WHERE Username = @username)
                BEGIN
                    INSERT INTO dbo.Users (Username, PasswordHash, Salt, FullName, Email, Role, IsActive, CreatedDate)
                    VALUES (@username, @passwordHash, @salt, @fullName, @email, @role, 1, GETDATE())
                    SELECT 'CREATED' as Status
                END
                ELSE
                BEGIN
                    SELECT 'EXISTS' as Status
                END
            `);

        if (userResult.recordset[0].Status === 'CREATED') {
            console.log('✅ Đã tạo tài khoản user1:');
            console.log(`   Username: ${userUsername}`);
            console.log(`   Password: ${userPassword}`);
            console.log('   Role: user\n');
        } else {
            console.log('⚠️  Tài khoản user1 đã tồn tại\n');
        }

        // Hiển thị danh sách users
        const result = await pool.request().query('SELECT UserID, Username, FullName, Role, IsActive FROM dbo.Users');
        console.log('📋 Danh sách tài khoản hiện có:');
        console.table(result.recordset);

        console.log('\n✨ Hoàn tất! Bạn có thể đăng nhập với các tài khoản trên.');

        await database.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        process.exit(1);
    }
}

createDefaultUsers();
