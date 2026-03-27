const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();
const createLogger = require('../shared/utils/logger');
const logger = createLogger('api-gateway');

const app = express();
const PORT = process.env.GATEWAY_PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || '';
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

if (IS_PRODUCTION) {
    app.set('trust proxy', 1);
}

app.use(helmet());
app.use(compression());

const apiRateLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please try again later'
    }
});
app.use('/api/', apiRateLimiter);

// CORS - Allow only production domain in production
const allowedOrigins = NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL]
    : [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5174'];

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function verifyAccessToken(req, res, next) {
    if (!REQUIRE_AUTH) {
        return next();
    }

    if (!JWT_SECRET) {
        return res.status(500).json({
            success: false,
            message: 'Authentication is not configured'
        });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        // Forward user info as headers to downstream microservices
        req.headers['x-user-id'] = String(req.user.userId || '');
        req.headers['x-user-role'] = String(req.user.role || '');
        req.headers['x-user-group-id'] = req.user.groupId != null ? String(req.user.groupId) : '';
        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
}

// Logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, { ip: req.ip });
    next();
});

// Service endpoints configuration
const SERVICES = {
    AUTH: process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
    DOCUMENTS: process.env.DOCUMENTS_SERVICE_URL || 'http://localhost:3003',
    DEPARTMENTS: process.env.DEPARTMENTS_SERVICE_URL || 'http://localhost:3004',
    FILES: process.env.FILES_SERVICE_URL || 'http://localhost:3005'
};

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        gateway: 'running',
        timestamp: new Date().toISOString(),
        services: SERVICES
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'API Gateway - Văn Phòng Điện Tử',
        version: '2.0.0',
        architecture: 'Microservices',
        services: {
            auth: '/api/auth/*',
            incomingDocuments: '/api/incoming-documents/*',
            outgoingDocuments: '/api/outgoing-documents/*',
            departments: '/api/departments/*',
            files: '/api/files/*'
        }
    });
});

// Proxy configuration for each service
const proxyOptions = {
    changeOrigin: true,
    logLevel: IS_PRODUCTION ? 'warn' : 'debug',
    onProxyReq: (proxyReq, req, res) => {
        logger.debug(`Proxy ${req.method} ${req.path} -> ${proxyReq.path}`);

        // Re-send body for POST/PUT requests
        if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
            proxyReq.end();
        }
    },
    onError: (err, req, res) => {
        logger.error(`Proxy error ${req.method} ${req.path}`, { error: err.message });
        res.status(502).json({
            success: false,
            message: 'Service unavailable',
            error: IS_PRODUCTION ? undefined : err.message
        });
    }
};

// Auth Service
app.use('/api/auth', createProxyMiddleware({
    target: SERVICES.AUTH,
    ...proxyOptions
}));

// Documents Service
app.use('/api/incoming-documents', verifyAccessToken, createProxyMiddleware({
    target: SERVICES.DOCUMENTS,
    ...proxyOptions
}));

app.use('/api/outgoing-documents', verifyAccessToken, createProxyMiddleware({
    target: SERVICES.DOCUMENTS,
    ...proxyOptions
}));

// Departments Service
app.use('/api/departments', verifyAccessToken, createProxyMiddleware({
    target: SERVICES.DEPARTMENTS,
    ...proxyOptions
}));

// Files Service
app.use('/api/files', verifyAccessToken, createProxyMiddleware({
    target: SERVICES.FILES,
    ...proxyOptions
}));

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found in gateway'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Gateway internal error', { error: err.message, stack: err.stack });
    res.status(500).json({
        success: false,
        message: 'Gateway internal error',
        error: IS_PRODUCTION ? 'Internal server error' : err.message
    });
});

// Start server
app.listen(PORT, () => {
    logger.info(`API Gateway started on port ${PORT}`);
    logger.info(`Auth required: ${REQUIRE_AUTH}`);
    Object.entries(SERVICES).forEach(([name, url]) => {
        logger.info(`Service ${name}: ${url}`);
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('Shutting down API Gateway (SIGTERM)');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('Shutting down API Gateway (SIGINT)');
    process.exit(0);
});
