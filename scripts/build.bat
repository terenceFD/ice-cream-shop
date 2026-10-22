@echo off
cd /d "c:\Users\forbi\Desktop\ice cream site\ice-cream-site"
call npx vite build > "%TEMP%\vite-build.log" 2>&1
echo exit=%ERRORLEVEL%
