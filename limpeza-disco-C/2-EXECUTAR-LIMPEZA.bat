@echo off
title Limpeza do Disco C:
echo.
echo  Iniciando a limpeza do disco C: ...
echo  O Windows vai pedir permissao de administrador: clique em "Sim".
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Limpar-DiscoC.ps1"
