/**
 * System Logger Factory
 * Usage: const logger = require('../../shared/utils/logger')('service-name');
 *
 * Log files:
 *   backend/logs/<service>/combined-YYYY-MM-DD.log  (14 ngày)
 *   backend/logs/<service>/error-YYYY-MM-DD.log     (30 ngày)
 */

const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_ROOT = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');

const devFormat = combine(
    colorize({ all: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    printf(({ timestamp, level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
    })
);

const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
);

function createLogger(serviceName) {
    const logDir = path.join(LOG_ROOT, serviceName);

    return winston.createLogger({
        level: process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'),
        defaultMeta: { service: serviceName },
        exitOnError: false,
        transports: [
            new winston.transports.DailyRotateFile({
                dirname: logDir,
                filename: 'combined-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                maxFiles: '14d',
                level: 'info',
                format: combine(timestamp(), errors({ stack: true }), json()),
            }),
            new winston.transports.DailyRotateFile({
                dirname: logDir,
                filename: 'error-%DATE%.log',
                datePattern: 'YYYY-MM-DD',
                maxFiles: '30d',
                level: 'error',
                format: combine(timestamp(), errors({ stack: true }), json()),
            }),
            IS_PRODUCTION
                ? new winston.transports.Console({ format: prodFormat })
                : new winston.transports.Console({ format: devFormat }),
        ],
    });
}

module.exports = createLogger;
