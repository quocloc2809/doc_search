# Microservices Start Script

@echo off
echo ====================================
echo Starting Microservices Architecture
echo ====================================
echo.

echo [1/5] Starting API Gateway (Port 3001)...
start "API Gateway" cmd /k "cd api-gateway && npm start"
timeout /t 2 /nobreak > nul

echo [2/5] Starting Auth Service (Port 3002)...
start "Auth Service" cmd /k "cd services\auth-service && npm start"
timeout /t 2 /nobreak > nul

echo [3/5] Starting Documents Service (Port 3003)...
start "Documents Service" cmd /k "cd services\documents-service && npm start"
timeout /t 2 /nobreak > nul

echo [4/5] Starting Departments Service (Port 3004)...
start "Departments Service" cmd /k "cd services\departments-service && npm start"
timeout /t 2 /nobreak > nul

echo [5/5] Starting Files Service (Port 3005)...
start "Files Service" cmd /k "cd services\files-service && npm start"

echo.
echo ====================================
echo All services started!
echo ====================================
echo API Gateway:       http://localhost:3001
echo Auth Service:      http://localhost:3002
echo Documents Service: http://localhost:3003
echo Departments:       http://localhost:3004
echo Files Service:     http://localhost:3005
echo ====================================
