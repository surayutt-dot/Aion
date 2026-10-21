@echo off
chcp 65001 > nul
title AION EV Charging Tracker
echo ========================================================
echo   AION EV Charging Expense Tracker (White Edition)
echo ========================================================
echo.
echo กำลังเปิดเซิร์ฟเวอร์...
echo.
start "" http://localhost:3000
node server.js
pause
