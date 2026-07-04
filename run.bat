@echo off
REM ===================================================================
REM  AlphaScribe - double-click launcher
REM  Finds Python and hands off to run.py, which sets up everything
REM  (venv, MongoDB, deps) on first run and starts all services.
REM ===================================================================
setlocal
cd /d "%~dp0"

REM --- locate a Python interpreter ---
set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY (
    where python >nul 2>nul && set "PY=python"
)
if not defined PY (
    echo.
    echo   Python was not found on your system.
    echo   Install Python 3.11+ from https://www.python.org/downloads/
    echo   and be sure to tick "Add Python to PATH" during setup.
    echo.
    pause
    exit /b 1
)

echo Using Python launcher: %PY%
echo Starting AlphaScribe...  (first run downloads MongoDB + installs deps - be patient)
echo.

%PY% "%~dp0run.py"
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
    echo AlphaScribe exited with an error (code %EXITCODE%). See the messages above.
) else (
    echo AlphaScribe stopped.
)
echo This window can be closed.
pause
endlocal
