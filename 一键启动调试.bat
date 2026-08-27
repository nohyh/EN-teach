@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo       LUMI 学生端 - 本地调试启动器
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [缺少环境] 当前电脑没有安装 Node.js。
  echo 请先安装 Node.js 22 或更高版本：
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 22 (
  echo [版本过低] 当前 Node.js 主版本为 %NODE_MAJOR%，项目需要 22 或更高版本。
  echo 请前往 https://nodejs.org/ 更新后重试。
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\.package-lock.json" (
  echo [1/2] 首次运行，正在安装依赖，请保持网络连接...
  call npm ci
  if errorlevel 1 (
    echo.
    echo [安装失败] 请检查网络后重新双击此文件。
    pause
    exit /b 1
  )
) else (
  echo [1/2] 依赖已经安装，跳过安装。
)

echo [2/2] 正在启动调试界面...
echo 浏览器地址：http://localhost:3000/
echo 关闭本窗口即可停止调试服务。
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:3000/'"
call npm run dev

echo.
echo 调试服务已停止。
pause

