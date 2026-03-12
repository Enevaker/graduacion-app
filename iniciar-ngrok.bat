@echo off
title Munecos Graduacion - Servidor + Ngrok
color 0A

echo.
echo  ==========================================
echo   Munecos de Graduacion - Modo Pruebas
echo  ==========================================
echo.

REM Verificar que node existe
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no encontrado. Instala Node.js desde nodejs.org
    pause
    exit /b 1
)

echo [1/2] Arrancando servidor en puerto 3000...
start "Servidor Node" cmd /k "cd /d %~dp0 && node server.js"

REM Esperar 2 segundos a que el servidor arranque
timeout /t 2 /nobreak >nul

echo [2/2] Abriendo tunel ngrok...
echo.
echo  Cuando aparezca la URL "Forwarding https://xxxx.ngrok-free.app"
echo  esa es tu URL publica. Compartela con quien quieras probar la app.
echo.
echo  Para cerrar todo: cierra ambas ventanas.
echo.

start "Ngrok Tunel" cmd /k "npx ngrok http 3000"

echo Listo! Revisa las ventanas abiertas.
echo.
pause
