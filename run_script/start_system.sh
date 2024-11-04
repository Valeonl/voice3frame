#!/bin/bash
echo "Starting Voice3Frame system..."

# Запускаем сервер в новом терминале с активацией виртуального окружения
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e 'tell app "Terminal" to do script "cd '$(pwd)'/server && source .venv/bin/activate && python app.py"'
else
    # Linux
    gnome-terminal -- bash -c "cd server && source .venv/bin/activate && python app.py; exec bash"
fi

# Даем серверу время на запуск
sleep 2

# Запускаем клиент в новом терминале
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e 'tell app "Terminal" to do script "cd '$(pwd)'/client && npm start"'
else
    # Linux
    gnome-terminal -- bash -c "cd client && npm start; exec bash"
fi

echo "System started successfully!" 