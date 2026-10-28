@echo off
chcp 65001 > nul
title SKP Render Pro IA - Servidor Local Independente
color 0A
echo ==============================================================================
echo                 SKP RENDER PRO IA - SERVIDOR LOCAL INDEPENDENTE
echo ==============================================================================
echo.
echo  Este inicializador permite rodar o SKP Render Pro no seu computador
echo  de forma 100%% independente, SEM precisar abrir a pagina do AI Studio!
echo.
echo  Status: Iniciando servidor na porta 3000...
echo.

if not exist node_modules (
    echo Instalando dependencias necessarias pela primeira vez...
    call npm install
)

echo.
echo ==============================================================================
echo  ✓ Servidor ativo em: http://localhost:3000
echo.
echo  No SketchUp, va em:
echo  Extensoes ^> SKP Render Pro IA ^> Configurar Servidor
echo  E digite: http://localhost:3000
echo.
echo  Mantenha esta janela aberta enquanto utiliza o SketchUp.
echo ==============================================================================
echo.
call npm run dev
pause
