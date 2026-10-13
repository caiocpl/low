@echo off
title Claude Code - Instalar status line Deck
echo.
echo  Instala a status line "Deck" do Claude Code para o seu usuario.
echo  O settings.json atual recebe um backup antes de ser alterado.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Instalar-StatusLine.ps1"
echo.
pause
