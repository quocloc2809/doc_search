# Van Phong Dien Tu - Microservices Architecture

## Architecture Overview

Dự án đã được chuyển sang kiến trúc **Microservices** với các service độc lập:

```
backend/
├── api-gateway/              # API Gateway (Port 3001)
├── services/
│   ├── auth-service/        # Authentication (Port 3002)
│   ├── documents-service/   # Documents Management (Port 3003)
│   ├── departments-service/ # Departments (Port 3004)
│   └── files-service/       # Files Upload/Download (Port 3005)
└── shared/
    └── config/              # Shared database config
```

## Services

### 1. API Gateway (Port 3001)
- **Role**: Entry point cho tất cả requests
- **Tech**: Express + http-proxy-middleware
- **Routes**: Proxy tất cả `/api/*` requests đến các service tương ứng

### 2. Auth Service (Port 3002)
- **Endpoints**:
  - `POST /api/auth/login` - Đăng nhập
  - `POST /api/auth/register` - Đăng ký
  - `POST /api/auth/change-password` - Đổi mật khẩu

### 3. Documents Service (Port 3003)
- **Endpoints**:
  - `/api/incoming-documents/*` - Văn bản đến
  - `/api/incoming-documents-mvc/*` - Văn bản đến (MVC)
  - `/api/outgoing-documents/*` - Văn bản đi

### 4. Departments Service (Port 3004)
- **Endpoints**:
  - `GET /api/departments` - Danh sách đơn vị

### 5. Files Service (Port 3005)
- **Endpoints**:
  - `POST /api/files/upload/:documentId` - Upload file
  - `GET /api/files/download/:documentId` - Download file

## Installation

### 1. Install API Gateway
```bash
cd api-gateway
npm install
cp .env.example .env
# Edit .env with your configuration
```

### 2. Install Each Service
```bash
cd services/auth-service
npm install
cp .env.example .env

cd ../documents-service
npm install

cd ../departments-service
npm install

cd ../files-service
npm install
```

### 3. Configure Shared Database
```bash
cd shared/config
cp .env.example .env
# Edit with your SQL Server credentials
```

## Running Services

### Option 1: Start All Services at Once
```bash
# From backend directory
start-services.bat
```

### Option 2: Start Individually
```bash
# Terminal 1 - API Gateway
cd api-gateway
npm start

# Terminal 2 - Auth Service
cd services/auth-service
npm start

# Terminal 3 - Documents Service
cd services/documents-service
npm start

# Terminal 4 - Departments Service
cd services/departments-service
npm start

# Terminal 5 - Files Service
cd services/files-service
npm start
```

## Development Mode
Each service supports `nodemon` for auto-reload:
```bash
npm run dev
```

## Health Checks
Each service has a health endpoint:
- Gateway: http://localhost:3001/health
- Auth: http://localhost:3002/health
- Documents: http://localhost:3003/health
- Departments: http://localhost:3004/health
- Files: http://localhost:3005/health

## Environment Variables

### API Gateway (.env)
```env
GATEWAY_PORT=3001
FRONTEND_URL=http://localhost:5173
AUTH_SERVICE_URL=http://localhost:3002
DOCUMENTS_SERVICE_URL=http://localhost:3003
DEPARTMENTS_SERVICE_URL=http://localhost:3004
FILES_SERVICE_URL=http://localhost:3005
```

### Each Service (.env)
```env
PORT=300X
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### Shared Database (shared/config/.env)
```env
DB_SERVER=localhost
DB_NAME=VanPhongDienTu
DB_USER=sa
DB_PASSWORD=your_password
DB_PORT=1433
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
```

## Frontend Configuration
Update frontend to point to API Gateway:
```javascript
// .env in frontend
VITE_API_BASE=http://localhost:3001
```

## Benefits of Microservices

1. **Scalability**: Scale individual services independently
2. **Isolation**: Service failures don't affect others
3. **Technology Flexibility**: Each service can use different tech
4. **Deployment**: Deploy services independently
5. **Development**: Teams can work on services independently

## Monitoring
Each service logs requests with timestamps:
```
2025-12-22T09:30:15.123Z - [Service Name] GET /api/...
```

## Troubleshooting

### Service won't start
1. Check port availability
2. Verify database connection in shared/config/.env
3. Check logs in terminal

### Gateway can't reach service
1. Verify service is running
2. Check service URLs in gateway .env
3. Test service health endpoint directly

### Database connection fails
1. Verify SQL Server is running
2. Check credentials in shared/config/.env
3. Test connection directly
