@echo off
rem Liga o sistema administrativo neste computador: API (porta 3100) e tela (porta 5173).
rem Cada servidor abre numa janela propria; para desligar, feche as duas janelas.
rem Usa o npm, que vem com o Node, para nao depender do yarn instalado no PATH.
setlocal
title Mais Envios Admin
cd /d "%~dp0"

set "PATH=%ProgramFiles%\nodejs;%PATH%"
where npm >nul 2>&1
if errorlevel 1 (
  echo Nao encontrei o Node.js. Instale o Node.js LTS e tente de novo.
  pause
  exit /b 1
)

sc query postgresql-x64-17 | find "RUNNING" >nul
if errorlevel 1 (
  echo O banco de dados PostgreSQL nao esta rodando. Tentando ligar...
  net start postgresql-x64-17 >nul 2>&1
  if errorlevel 1 echo Nao consegui ligar o banco. Abra "Servicos" do Windows e inicie "postgresql-x64-17".
)

netstat -ano | find ":3100 " | find "LISTENING" >nul
if errorlevel 1 (
  start "Mais Envios - API - nao feche" /d "%~dp0backend" cmd /k npm run start:dev
) else (
  echo A API ja estava ligada.
)

netstat -ano | find ":5173 " | find "LISTENING" >nul
if errorlevel 1 (
  start "Mais Envios - Tela - nao feche" /d "%~dp0frontend" cmd /k npm run dev
) else (
  echo A tela ja estava ligada.
)

echo Aguardando o sistema ficar pronto...
set /a tries=0
:wait
netstat -ano | find ":3100 " | find "LISTENING" >nul
if errorlevel 1 goto again
netstat -ano | find ":5173 " | find "LISTENING" >nul
if errorlevel 1 goto again
goto ready
:again
set /a tries+=1
if %tries% geq 90 (
  echo O sistema demorou para ligar. Confira as janelas da API e da tela.
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait

:ready
start "" "http://localhost:5173"
endlocal
