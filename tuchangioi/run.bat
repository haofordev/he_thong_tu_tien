@echo off
echo Đang khởi động hệ thống tu tiên...

:: Khởi chạy Acc Chính
start "CHÂN GIỚI - MAIN BOT" node main.js

:: Khởi chạy Acc Clone
start "CHÂN GIỚI - CLONE BOT" node auto_bot.js

exit
