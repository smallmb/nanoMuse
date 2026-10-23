@echo off
setlocal

where pwsh >nul 2>nul
if errorlevel 1 (
  echo PowerShell 7 ^(pwsh^) was not found. Install it, then run this file again.
  pause
  exit /b 1
)

pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-feed-preview.ps1"
if errorlevel 1 (
  echo Web preview startup failed. See the message above.
  pause
  exit /b 1
)
exit /b 0