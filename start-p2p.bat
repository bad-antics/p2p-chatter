@echo off
REM P2P Chatter Launcher Script (Windows)

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  P2P CHATTER LAUNCHER                                     ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Step 1: Check Node.js
echo Step 1: Checking Node.js installation...
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js not found. Please install from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js %NODE_VERSION% found

REM Step 2: Install dependencies
echo.
echo Step 2: Installing dependencies...
if not exist "node_modules" (
    call npm install
    echo ✓ Dependencies installed
) else (
    echo ✓ Dependencies already installed
)

REM Step 3: Build
echo.
echo Step 3: Building TypeScript...
call npm run build
echo ✓ Build complete

REM Step 4: Run tests (optional)
echo.
echo Step 4: Running tests...
call npm test
if errorlevel 1 (
    echo ⚠ Tests skipped (optional)
)

REM Step 5: Start
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  ✓ P2P CHATTER LAUNCHED                                   ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Starting development server...
echo.

call npm run dev

pause
