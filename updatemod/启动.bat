@echo off
chcp 65001 >nul
cd /d "%~dp0"
title STS2 MOD 更新工具

where node >nul 2>nul
if errorlevel 1 (
  echo 没找到 Node.js，请先安装：https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo 首次运行，正在安装依赖，请稍等...
  call npm install
)

if not exist dist\index.html (
  echo 正在打包前端...
  call npm run build
)

echo 启动中，浏览器会自动打开...
node server\index.mjs
pause
