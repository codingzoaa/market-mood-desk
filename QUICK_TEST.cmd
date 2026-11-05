@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required.
  pause
  exit /b 1
)
node scripts\quick-test.mjs
set "RESULT=%ERRORLEVEL%"
echo.
if %RESULT% EQU 0 (echo PASS - offline smoke test) else (echo FAIL - see output above)
pause
exit /b %RESULT%
