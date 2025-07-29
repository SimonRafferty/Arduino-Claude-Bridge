@echo off
echo Starting Arduino Claude Bridge...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Arduino CLI is installed
arduino-cli version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Arduino CLI is not installed or not in PATH
    echo Please install Arduino CLI from https://arduino.github.io/arduino-cli/
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo Starting bridge server...
echo.
echo ================================
echo  Arduino Claude Bridge Running
echo ================================
echo.
echo Open your browser to: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

REM Start the server and open browser
start http://localhost:3000
node server.js

pause