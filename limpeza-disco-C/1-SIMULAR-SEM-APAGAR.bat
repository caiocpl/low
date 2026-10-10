@echo off
title Limpeza do Disco C: - SIMULACAO
echo.
echo  MODO SIMULACAO: apenas diagnostico, nada sera apagado.
echo  O Windows vai pedir permissao de administrador: clique em "Sim".
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Limpar-DiscoC.ps1" -Simular
