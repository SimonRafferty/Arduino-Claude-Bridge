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

REM Check if Arduino CLI is available (local or in PATH)
if exist "arduino-cli.exe" (
    echo Found arduino-cli.exe in local folder
    arduino-cli.exe version >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Local arduino-cli.exe is not working properly
        pause
        exit /b 1
    )
) else (
    arduino-cli version >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Arduino CLI not found
        echo.
        echo Please either:
        echo 1. Download arduino-cli.exe and put it in this folder, OR
        echo 2. Install Arduino CLI system-wide from https://arduino.github.io/arduino-cli/
        echo.
        pause
        exit /b 1
    )
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
echo  Arduino Claude Bridge
echo ================================
echo.

REM Start the server
echo Server starting...
echo.
echo AFTER the server starts, open your browser to:
echo http://localhost:3000
echo.
echo Press Ctrl+C to stop the server when done
echo.

node server.js

echo.
echo Server stopped.
pause
