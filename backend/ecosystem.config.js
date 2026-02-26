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
                PORT: 3001
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
                PORT: 3002
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
                PORT: 3003
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
                PORT: 3004
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
                PORT: 3005
            },
            error_file: './logs/files-service-error.log',
            out_file: './logs/files-service-out.log'
        }
    ]
};
