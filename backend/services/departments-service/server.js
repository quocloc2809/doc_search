const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const database = require('../../shared/config/database');
const departmentsRoutes = require('./routes/departments');

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
    console.log(`${new Date().toISOString()} - [Departments Service] ${req.method} ${req.path}`);
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
    console.error('[Departments Service Error]:', err);
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
            console.log(`🏢 Departments Service running at: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Error starting departments service:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 Shutting down departments service...');
    await database.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🔄 Shutting down departments service...');
    await database.disconnect();
    process.exit(0);
});

startServer();
