@echo off
echo ========================================
echo    القرآن الكريم - تطبيق PWA
echo ========================================
echo.
echo جاري بدء الخادم المحلي...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo خطأ: Python غير مثبت
    echo يرجى تثبيت Python من python.org
    pause
    exit /b
)

echo تم العثور على Python
echo.
echo الخادم يعمل على:
echo http://localhost:8000/quran.html
echo.
echo لإيقاف الخادم، اضغط Ctrl+C
echo ========================================
echo.

python server.py

pause
