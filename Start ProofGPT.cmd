@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Install Node.js 22.12 or newer, then run npm install in this folder first.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo ProofGPT needs its first build. With Node.js 22.12 or newer, run npm run build.
  pause
  exit /b 1
)
set ELECTRON_RUN_AS_NODE=
set PROOFGPT_DEV_URL=
start "" /D "%~dp0" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
