@echo off
echo Run System Voice3Frame...

:: Активируем виртуальное окружение и запускаем сервер в новом окне
start cmd /k "cd server && .\venv\Scripts\activate && python app.py"

:: Даем серверу время на запуск
timeout /t 2 /nobreak > nul

:: Запускаем клиент в новом окне
start cmd /k "cd client && npm start"

echo Voice3Frame success running!