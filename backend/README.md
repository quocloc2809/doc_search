# Văn Phòng Điện Tử - Backend API

## Cài đặt

1. Cài đặt dependencies:
```bash
cd backend
npm install
```

2. Cấu hình database:
- Chỉnh sửa file `.env` với thông tin SQL Server của bạn
- Tạo database và bảng theo script bên dưới

3. Chạy server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Cấu hình SQL Server

### Tạo Database và Bảng

```sql
-- Tạo database
CREATE DATABASE VanPhongDienTu;
GO

USE VanPhongDienTu;
GO

-- Tạo bảng CongVan
CREATE TABLE CongVan (
    id INT IDENTITY(1,1) PRIMARY KEY,
    so_hieu NVARCHAR(100) NOT NULL,
    trich_yeu NVARCHAR(500) NOT NULL,
    ban_hanh NVARCHAR(200),
    ngay_ban_hanh DATETIME,
    lanh_dao_but_phe NVARCHAR(200),
    don_vi_ly_chinh NVARCHAR(200),
    xu_ly_chinh NVARCHAR(200),
    ngay_bat_dau DATETIME,
    ngay_ket_thuc DATETIME,
    trang_thai NVARCHAR(100),
    ket_qua_xu_ly NVARCHAR(100),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

-- Thêm dữ liệu mẫu
INSERT INTO CongVan (
    so_hieu, trich_yeu, ban_hanh, ngay_ban_hanh,
    lanh_dao_but_phe, don_vi_ly_chinh, xu_ly_chinh,
    ngay_bat_dau, ngay_ket_thuc, trang_thai, ket_qua_xu_ly
) VALUES 
(N'5006/BIXH-KT-MT', N'Thông tu hướng dẫn về thủ tục tình gộp thử HS-HB...', 
 N'Ban QLDA về các công các việc phối Bộc', '2025-08-20',
 N'Chưa', N'Ban Thêm sinh', N'Đã xử lí chính',
 '2025-08-30', '2025-10-05', N'Chưa hoàn thành', N'Chưa xử lí'),

(N'1234/TCKT-VP', N'Báo cáo tình hình thực hiện kế hoạch quý III/2025',
 N'Phòng Tài chính Kế toán', '2025-08-22',
 N'Đã duyệt', N'Ban Giám đốc', N'Hoàn thành',
 '2025-08-25', '2025-09-15', N'Đã hoàn thành', N'Đã xử lí'),

(N'2468/NS-HC', N'Quyết định bổ nhiệm cán bộ quản lý',
 N'Phòng Nhân sự', '2025-08-25',
 N'Đang xử lí', N'Ban Tổ chức', N'Đang thực hiện',
 '2025-08-28', '2025-10-20', N'Đang thực hiện', N'Đang xử lí');
```

## API Endpoints

### Documents (Công văn)

- `GET /api/documents` - Lấy danh sách tất cả công văn
- `GET /api/documents/:id` - Lấy thông tin chi tiết một công văn
- `POST /api/documents` - Tạo công văn mới
- `PUT /api/documents/:id` - Cập nhật công văn
- `DELETE /api/documents/:id` - Xóa công văn

### Statistics (Thống kê)

- `GET /api/statistics` - Thống kê trạng thái công văn
- `GET /api/statistics/monthly?year=2025` - Thống kê theo tháng
- `GET /api/statistics/department` - Thống kê theo phòng ban

## Cấu trúc Project

```
backend/
├── config/
│   └── database.js          # Cấu hình kết nối SQL Server
├── routes/
│   ├── documents.js         # API routes cho công văn
│   └── statistics.js        # API routes cho thống kê
├── .env                     # Biến môi trường
├── package.json
├── server.js               # File chính
└── README.md
```

## Environment Variables

```
NODE_ENV=development
PORT=3001
DB_SERVER=localhost
DB_DATABASE=VanPhongDienTu
DB_USER=sa
DB_PASSWORD=yourpassword
DB_PORT=1433
FRONTEND_URL=http://localhost:5173
```