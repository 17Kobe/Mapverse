@echo off
chcp 65001 >nul
cd /d "%~dp0"
python scripts\serve_local.py %*
pause
