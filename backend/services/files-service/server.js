const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const database = require('../../shared/config/database');
const filesRoutes = require('./routes/files');
const createLogger = require('../../shared/utils/logger');
const logger = createLogger('files');

const app = express();
const PORT = process.env.PORT || 3005;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Content-Type']
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
            service: 'files',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            service: 'files',
            database: 'disconnected',
            error: IS_PRODUCTION ? 'Service unavailable' : error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Routes
app.use('/api/files', filesRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Files service internal error', { error: err.message, stack: err.stack });
    res.status(500).json({
        success: false,
        message: 'Files service internal error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found in files service'
    });
});

// Start server
async function startServer() {
    try {
        await database.connect();
        app.listen(PORT, () => {
            logger.info(`Files Service started on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Error starting files service', { error: error.message });
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('Shutting down files service (SIGTERM)');
    await database.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Shutting down files service (SIGINT)');
    await database.disconnect();
    process.exit(0);
});

startServer();
