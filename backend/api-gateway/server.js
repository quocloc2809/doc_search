const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
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

const LOG_ROOT = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
const AUDIT_DIR = path.join(LOG_ROOT, 'audit');

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

function parseAllowedOrigins(value) {
    return String(value || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}

const configuredOrigins = parseAllowedOrigins(process.env.FRONTEND_URLS || process.env.FRONTEND_URL);
const devFallbackOrigins = ['http://localhost:5173', 'http://localhost:5174'];

// CORS - Gateway is the single source of truth for browser origins.
const allowedOrigins = NODE_ENV === 'production'
    ? configuredOrigins
    : Array.from(new Set([...configuredOrigins, ...devFallbackOrigins]));

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
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

function requireAdmin(req, res, next) {
    if (!REQUIRE_AUTH) {
        return next();
    }

    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });
    }

    if (String(req.user.role || '').toLowerCase() !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Forbidden'
        });
    }

    return next();
}

function isValidAuditDate(date) {
    return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
}

async function resolveAuditLogFilePath(date) {
    if (date) {
        if (!isValidAuditDate(date)) {
            return { error: 'Invalid date format. Use YYYY-MM-DD.' };
        }

        return { filePath: path.join(AUDIT_DIR, `audit-${date}.log`), date };
    }

    try {
        const entries = await fs.promises.readdir(AUDIT_DIR, { withFileTypes: true });
        const files = entries
            .filter((e) => e.isFile())
            .map((e) => e.name)
            .filter((name) => /^audit-\d{4}-\d{2}-\d{2}\.log$/.test(name))
            .sort();

        const latest = files[files.length - 1];
        if (!latest) {
            return { filePath: null, date: null };
        }

        const latestDate = latest.slice('audit-'.length, 'audit-YYYY-MM-DD'.length);
        return { filePath: path.join(AUDIT_DIR, latest), date: latestDate };
    } catch (err) {
        if (err && err.code === 'ENOENT') {
            return { filePath: null, date: null };
        }
        throw err;
    }
}

function parseJsonLine(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed) return null;

    try {
        const obj = JSON.parse(trimmed);
        if (!obj || typeof obj !== 'object') {
            return null;
        }

        // Winston json formatter typically stores the logged object in `message`.
        // Our audit logger logs objects (action, ip, userId, username...), so flatten
        // message fields to top-level for easier consumption in UI.
        if (obj.message && typeof obj.message === 'object' && !Array.isArray(obj.message)) {
            const flattened = { ...obj, ...obj.message };
            delete flattened.message;
            return flattened;
        }

        return obj;
    } catch {
        return null;
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

// Audit logs (admin only)
// GET /api/audit?date=YYYY-MM-DD&limit=200
app.get('/api/audit', verifyAccessToken, requireAdmin, async (req, res, next) => {
    try {
        const date = req.query.date;
        const limitRaw = req.query.limit;
        const limit = Math.max(1, Math.min(Number(limitRaw || 200), 1000));

        const resolved = await resolveAuditLogFilePath(date);
        if (resolved.error) {
            return res.status(400).json({ success: false, message: resolved.error });
        }

        if (!resolved.filePath) {
            return res.json({ success: true, data: [], meta: { date: resolved.date } });
        }

        let content;
        try {
            content = await fs.promises.readFile(resolved.filePath, 'utf8');
        } catch (err) {
            if (err && err.code === 'ENOENT') {
                return res.json({ success: true, data: [], meta: { date: resolved.date } });
            }
            throw err;
        }

        const lines = content.split(/\r?\n/).filter(Boolean);
        const tailLines = lines.slice(-limit);
        const items = tailLines
            .map(parseJsonLine)
            .filter(Boolean)
            .reverse();

        return res.json({ success: true, data: items, meta: { date: resolved.date } });
    } catch (err) {
        return next(err);
    }
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
    onProxyRes: (proxyRes) => {
        // Downstream services also set CORS and can overwrite gateway headers.
        // Remove those headers so CORS is consistently controlled at gateway level.
        delete proxyRes.headers['access-control-allow-origin'];
        delete proxyRes.headers['access-control-allow-credentials'];
        delete proxyRes.headers['access-control-allow-methods'];
        delete proxyRes.headers['access-control-allow-headers'];
        delete proxyRes.headers['access-control-expose-headers'];
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
    logger.info(`CORS allowed origins: ${allowedOrigins.join(', ') || '(none configured)'}`);
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
