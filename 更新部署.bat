@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   环境百词斩 - 一键更新部署
echo ============================================
echo.
echo [1/3] 自动升级缓存版本(让老用户能看到更新)...
powershell -ExecutionPolicy Bypass -NoProfile -Command "$p='sw.js';$c=Get-Content $p -Raw;$c=[regex]::Replace($c,'hj-cache-v(\d+)',{param($m) 'hj-cache-v'+([int]$m.Groups[1].Value+1)});[System.IO.File]::WriteAllText((Resolve-Path $p),$c)"
echo [2/3] 提交改动...
git add -A
git commit -m "更新 %date% %time%"
echo [3/3] 上传到 GitHub...
git push
echo.
echo ============================================
echo   完成! 1-2分钟后刷新网页即可看到更新:
echo   https://tianjiao-tnpp.github.io/huanjing/
echo ============================================
pause
