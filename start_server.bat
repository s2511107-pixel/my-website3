@echo off
title Puzzle Game Local Server
cd /d "%~dp0"
echo Starting local puzzle game server on http://localhost:8080/
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File server.ps1
pause
