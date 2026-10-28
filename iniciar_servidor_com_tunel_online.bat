@echo off
chcp 65001 > nul
title SKP RENDER PRO IA - Servidor Online com Tunel Gratuito (Sem Faturamento / Sem Login)
color 0B

echo ==============================================================================
echo       SKP RENDER PRO IA - SERVIDOR ONLINE GRATUITO (CLOUDFLARE TUNNEL)
echo ==============================================================================
echo.
echo  Este inicializador cria uma URL ONLINE PUBLICA GRATUITA (HTTPS)
echo  para seus clientes e para o seu notebook acessarem sem precisar pagar nada
echo  e SEM precisar de conta Google / Gmail!
echo.
echo ==============================================================================
echo.

if not exist node_modules (
    echo [1/3] Instalando dependencias necessarias pela primeira vez...
    call npm install
)

echo [2/3] Iniciando Servidor Local SKP Render Pro na porta 3000...
start "SKP Servidor Backend" /min cmd /c "npx tsx server.ts"

timeout /t 3 > nul

echo [3/3] Criando Link Publico Online Seguro (HTTPS)...
echo.
echo  Aguarde enquanto o link seguro e gerado...
echo.

if not exist cloudflared.exe (
    echo Baixando conector de tunel seguro oficial da Cloudflare (apenas na 1a vez)...
    curl -s -L -o cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
)

if exist cloudflared.exe (
    echo.
    echo ==============================================================================
    echo  COPIE O LINK HTTPS GERADO ABAIXO (ex: https://xxx.trycloudflare.com)
    echo  E COLE NO SKETCHUP DO SEU NOTEBOOK OU CLIENTE EM:
    echo  Extensoes ^> SKP RENDER PRO IA ^> Configurar Servidor
    echo ==============================================================================
    echo.
    cloudflared.exe tunnel --url http://localhost:3000
) else (
    echo Usando LocalTunnel como alternativa...
    npx localtunnel --port 3000
)

pause
