/**
 * Audit Logger — ghi lại hành động của người dùng
 * Usage: const audit = require('../../shared/utils/auditLogger');
 *        audit.log('LOGIN', { userId, username, ip });
 *
 * Log file: backend/logs/audit/audit-YYYY-MM-DD.log (giữ 180 ngày)
 *
 * Actions hiện có:
 *   AUTH     : LOGIN_SUCCESS, LOGIN_FAILED, REGISTER
 *   ADMIN    : ADMIN_CREATE_USER, ADMIN_UPDATE_USER, ADMIN_DELETE_USER, ADMIN_RESET_PASSWORD
 *   FILES    : DOWNLOAD_INCOMING_FILE, DOWNLOAD_OUTGOING_FILE
 *   DOCS     : VIEW_INCOMING_LIST, VIEW_OUTGOING_LIST, VIEW_INCOMING_DETAIL, VIEW_OUTGOING_DETAIL
 */

const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const LOG_ROOT = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');
const auditDir = path.join(LOG_ROOT, 'audit');

const auditLogger = winston.createLogger({
    level: 'info',
    exitOnError: false,
    transports: [
        new winston.transports.DailyRotateFile({
            dirname: auditDir,
            filename: 'audit-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxFiles: '180d',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
        }),
    ],
});

/**
 * Ghi một audit event
 * @param {string} action - Tên hành động, VD: 'LOGIN_SUCCESS'
 * @param {object} data   - Thông tin bổ sung: userId, username, ip, detail...
 */
function log(action, data = {}) {
    auditLogger.info({ action, ...data });
}

module.exports = { log };
