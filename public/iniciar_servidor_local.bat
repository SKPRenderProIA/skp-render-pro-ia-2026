@echo off
chcp 65001 > nul
title SKP RENDER PRO IA - Servidor Local (Porta 3000)
color 0A

echo ==============================================================================
echo       SKP RENDER PRO IA - SERVIDOR LOCAL (PORTA 3000)
echo ==============================================================================
echo.
echo  Conectando com o SketchUp automaticamente sem precisar configurar nada!
echo.
echo  Mantenha esta janela aberta enquanto utiliza o plugin no SketchUp.
echo.
echo ==============================================================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo [1/2] Instalando dependencias na primeira execucao...
    call npm install
)

echo [2/2] Servidor iniciando em http://localhost:3000...
echo.

call npx tsx server.ts
pause
