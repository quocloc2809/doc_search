-- Tạo bảng Users để quản lý tài khoản đăng nhập
-- Chạy script này trong SQL Server Management Studio (SSMS)

USE [VEC_PORTALOFFICE8_NEW];
GO

-- Tạo bảng Users nếu chưa tồn tại
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Users] (
        [UserID] INT IDENTITY(1,1) PRIMARY KEY,
        [Username] NVARCHAR(50) NOT NULL UNIQUE,
        [PasswordHash] NVARCHAR(200) NOT NULL,
        [Salt] NVARCHAR(50) NOT NULL,
        [FullName] NVARCHAR(100) NOT NULL,
        [Email] NVARCHAR(100) NULL,
        [Role] NVARCHAR(20) NOT NULL DEFAULT 'user', -- Có thể là: 'admin', 'user', 'manager'
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedDate] DATETIME NOT NULL DEFAULT GETDATE(),
        [UpdatedDate] DATETIME NULL,
        [LastLoginDate] DATETIME NULL
    );

    PRINT 'Bảng Users đã được tạo thành công.';
END
ELSE
BEGIN
    PRINT 'Bảng Users đã tồn tại.';
END
GO

-- Tạo index để tăng tốc độ query
CREATE NONCLUSTERED INDEX [IX_Users_Username] ON [dbo].[Users] ([Username]);
CREATE NONCLUSTERED INDEX [IX_Users_IsActive] ON [dbo].[Users] ([IsActive]);
GO

-- =====================================================================
-- TẠO TÀI KHOẢN ADMIN MẶC ĐỊNH
-- =====================================================================
-- Tài khoản: admin
-- Mật khẩu: Admin@123
-- QUAN TRỌNG: Đổi mật khẩu ngay sau khi đăng nhập lần đầu!

DECLARE @username NVARCHAR(50) = 'admin';
DECLARE @password NVARCHAR(100) = 'Admin@123';
DECLARE @salt NVARCHAR(50) = '8e5e8f8f9c9e4d4b9a9b8c7d6e5f4a3b'; -- Salt cố định cho demo
DECLARE @passwordHash NVARCHAR(200) = 'ab2368cba9c9fdf451265e0a89d88a1ca01e5e88dc881a195a06c58966b4513f6f0e791aa466da7cf382ffa34418d9b2f42337e4d61a5c71787ca87195a40245'; -- Hash PBKDF2-SHA512 của 'Admin@123' với salt trên

IF NOT EXISTS (SELECT * FROM [dbo].[Users] WHERE Username = @username)
BEGIN
    INSERT INTO [dbo].[Users] (Username, PasswordHash, Salt, FullName, Email, Role, IsActive, CreatedDate)
    VALUES (@username, @passwordHash, @salt, N'Quản trị viên', 'admin@example.com', 'admin', 1, GETDATE());
    
    PRINT 'Tài khoản admin đã được tạo:';
    PRINT '  - Username: admin';
    PRINT '  - Password: Admin@123';
    PRINT '  - LƯU Ý: Hãy đổi mật khẩu ngay sau khi đăng nhập!';
END
ELSE
BEGIN
    PRINT 'Tài khoản admin đã tồn tại.';
END
GO

-- =====================================================================
-- TẠO THÊM TÀI KHOẢN USER MẪU (tùy chọn)
-- =====================================================================
-- Tài khoản: user1
-- Mật khẩu: User@123

DECLARE @username2 NVARCHAR(50) = 'user1';
DECLARE @password2 NVARCHAR(100) = 'User@123';
DECLARE @salt2 NVARCHAR(50) = '7d4c3b2a1e0f9e8d7c6b5a4f3e2d1c0b'; -- Salt cố định cho demo
DECLARE @passwordHash2 NVARCHAR(200) = '062b72fa7a682950c6b877275664b89a2da81028d70006726706f7163165ed58412db894b0f6e4f2d7c7ba67f893ddef799280ca89a07efa1bc054d5dc548a76'; -- Hash PBKDF2-SHA512 của 'User@123' với salt trên

IF NOT EXISTS (SELECT * FROM [dbo].[Users] WHERE Username = @username2)
BEGIN
    INSERT INTO [dbo].[Users] (Username, PasswordHash, Salt, FullName, Email, Role, IsActive, CreatedDate)
    VALUES (@username2, @passwordHash2, @salt2, N'Người dùng 1', 'user1@example.com', 'user', 1, GETDATE());
    
    PRINT 'Tài khoản user1 đã được tạo:';
    PRINT '  - Username: user1';
    PRINT '  - Password: User@123';
END
ELSE
BEGIN
    PRINT 'Tài khoản user1 đã tồn tại.';
END
GO

-- =====================================================================
-- THÊM CỘT GroupID (chạy 1 lần nếu bảng đã tồn tại)
-- =====================================================================
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'GroupID'
)
BEGIN
    ALTER TABLE [dbo].[Users] ADD [GroupID] INT NULL;
    PRINT 'Đã thêm cột GroupID vào bảng Users.';
END
GO

-- =====================================================================
-- KIỂM TRA DỮ LIỆU
-- =====================================================================
SELECT 
    UserID,
    Username,
    FullName,
    Email,
    Role,
    GroupID,
    IsActive,
    CreatedDate,
    LastLoginDate
FROM [dbo].[Users]
ORDER BY CreatedDate DESC;
GO

PRINT '=================================================================';
PRINT 'Script hoàn tất!';
PRINT 'Các endpoint API đăng nhập:';
PRINT '  - POST /api/auth/login          - Đăng nhập';
PRINT '  - POST /api/auth/register       - Tạo tài khoản mới (admin)';
PRINT '  - POST /api/auth/change-password - Đổi mật khẩu';
PRINT '=================================================================';
