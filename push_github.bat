@echo off
echo =======================================
echo     PUSH CODE TO GITHUB
echo =======================================
echo.

echo [1/3] Adding all changes (git add .)...
git add .
echo.

set /p commit_msg="Enter commit message (or press Enter for default): "
if "%commit_msg%"=="" set commit_msg=Fix authentication errors

echo.
echo [2/3] Committing code...
git commit -m "%commit_msg%"
echo.

echo [3/3] Pushing to GitHub...
git push origin main
REM If your branch is master, change 'main' to 'master' above

echo.
echo =======================================
echo     DONE!
echo =======================================
pause
