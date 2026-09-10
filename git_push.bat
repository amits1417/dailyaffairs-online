@echo off
cd /d "C:\Users\dellll\.gemini\antigravity\scratch\indiabix-multilingual-clone"
echo ===================================================
echo DailyAffairs.online - GitHub and Vercel Prep
echo ===================================================

if not exist ".git" (
    echo Initializing local Git repository...
    git init
)

git rm -r --cached node_modules 2>nul
git add .
git commit -m "Deploy DailyAffairs.online"

echo ===================================================
echo Local files committed cleanly without node_modules!
echo ===================================================
pause
