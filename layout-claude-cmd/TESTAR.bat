@echo off
title Claude Code - Testar status line Deck
chcp 65001 >nul
echo.
echo  Simulando a status line com o modelo Opus e esforco medium:
echo.
type "%~dp0exemplo-entrada.json" | powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0statusline.ps1"
echo.
pause
