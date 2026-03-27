const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const database = require('../../shared/config/database');
const departmentsRoutes = require('./routes/departments');
const createLogger = require('../../shared/utils/logger');
const logger = createLogger('departments');

const app = express();
const PORT = process.env.PORT || 3004;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, { ip: req.ip });
    next();
});

// Health check
app.get('/health', async (req, res) => {
    try {
        await database.getPool().request().query('SELECT 1 AS ok');
        res.json({
            status: 'healthy',
            service: 'departments',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            service: 'departments',
            database: 'disconnected',
            error: IS_PRODUCTION ? 'Service unavailable' : error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Routes
app.use('/api/departments', departmentsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Departments service internal error', { error: err.message, stack: err.stack });
    res.status(500).json({
        success: false,
        message: 'Departments service internal error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found in departments service'
    });
});

// Start server
async function startServer() {
    try {
        await database.connect();
        app.listen(PORT, () => {
            logger.info(`Departments Service started on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Error starting departments service', { error: error.message });
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('Shutting down departments service (SIGTERM)');
    await database.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Shutting down departments service (SIGINT)');
    await database.disconnect();
    process.exit(0);
});

startServer();
