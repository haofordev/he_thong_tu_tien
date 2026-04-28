@echo off
cd /d %~dp0
call node app.js data.json
pause
