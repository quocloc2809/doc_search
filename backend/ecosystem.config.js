module.exports = {
    apps: [
        {
            name: 'api-gateway',
            cwd: './api-gateway',
            script: 'server.js',
            instances: 2,
            exec_mode: 'cluster',
            env_production: {
                NODE_ENV: 'production',
                PORT: 3001,
                FRONTEND_URL: 'http://10.2.18.33:5173',
                REQUIRE_AUTH: 'true',
                JWT_SECRET: '1b3a5c71fd083399a48868012e9d88bc1118cf73668230b1347cc022766a7c1b',
                JWT_EXPIRES_IN: '8h',
                AUTH_SERVICE_URL: 'http://localhost:3002',
                DOCUMENTS_SERVICE_URL: 'http://localhost:3003',
                DEPARTMENTS_SERVICE_URL: 'http://localhost:3004',
                FILES_SERVICE_URL: 'http://localhost:3005'
            },
            error_file: './logs/api-gateway-error.log',
            out_file: './logs/api-gateway-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
        },
        {
            name: 'auth-service',
            cwd: './services/auth-service',
            script: 'server.js',
            instances: 1,
            env_production: {
                NODE_ENV: 'production',
                PORT: 3002,
                FRONTEND_URL: 'http://10.2.18.33:5173',
                JWT_SECRET: '1b3a5c71fd083399a48868012e9d88bc1118cf73668230b1347cc022766a7c1b',
                JWT_EXPIRES_IN: '8h'
            },
            error_file: './logs/auth-service-error.log',
            out_file: './logs/auth-service-out.log'
        },
        {
            name: 'documents-service',
            cwd: './services/documents-service',
            script: 'server.js',
            instances: 2,
            exec_mode: 'cluster',
            env_production: {
                NODE_ENV: 'production',
                PORT: 3003,
                FRONTEND_URL: 'http://10.2.18.33:5173'
            },
            error_file: './logs/documents-service-error.log',
            out_file: './logs/documents-service-out.log'
        },
        {
            name: 'departments-service',
            cwd: './services/departments-service',
            script: 'server.js',
            instances: 1,
            env_production: {
                NODE_ENV: 'production',
                PORT: 3004,
                FRONTEND_URL: 'http://10.2.18.33:5173'
            },
            error_file: './logs/departments-service-error.log',
            out_file: './logs/departments-service-out.log'
        },
        {
            name: 'files-service',
            cwd: './services/files-service',
            script: 'server.js',
            instances: 1,
            env_production: {
                NODE_ENV: 'production',
                PORT: 3005,
                FRONTEND_URL: 'http://10.2.18.33:5173',
                FILE_STORAGE_ROOT: '/home/vecadmin/files'
            },
            error_file: './logs/files-service-error.log',
            out_file: './logs/files-service-out.log'
        }
    ]
};