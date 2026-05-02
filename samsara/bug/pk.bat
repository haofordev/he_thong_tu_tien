@echo off

:: CMD 2 chạy sau 10s
start cmd /k "node multi_clone_bc.js"

:: Delay 10 giây
timeout /t 10 /nobreak >nul


:: CMD 1 chạy ngay
start cmd /k "node main_pk.js"