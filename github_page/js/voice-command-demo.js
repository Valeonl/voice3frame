document.addEventListener('DOMContentLoaded', () => {
    const voiceAPI = new VoiceCommandAPI();
    const startButton = document.getElementById('startListening');
    const stopButton = document.getElementById('stopListening');
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    const logContainer = document.querySelector('.log-container');

    // Функция для добавления записи в лог
    function addLogEntry(message, type = 'command') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // Инициализация API
    if (voiceAPI.init()) {
        // Регистрация команд
        voiceAPI.registerCommand('обрезать', (command) => {
            addLogEntry(`Выполняется команда обрезки: "${command}"`);
        });

        voiceAPI.registerCommand('удалить', (command) => {
            addLogEntry(`Выполняется команда удаления: "${command}"`);
        });

        // Обработчики событий
        voiceAPI.onCommand((command, recognizedCommand) => {
            addLogEntry(`Распознана команда: "${command}"`);
        });

        voiceAPI.onError((error) => {
            addLogEntry(error, 'error');
        });

        voiceAPI.onStatusChange((status) => {
            statusText.textContent = status;
            if (status === 'Слушаю...') {
                statusDot.classList.add('listening');
            } else {
                statusDot.classList.remove('listening');
            }
        });

        // Обработчики кнопок
        startButton.addEventListener('click', () => {
            voiceAPI.startListening();
            startButton.disabled = true;
            stopButton.disabled = false;
        });

        stopButton.addEventListener('click', () => {
            voiceAPI.stopListening();
            startButton.disabled = false;
            stopButton.disabled = true;
        });
    } else {
        addLogEntry('Ваш браузер не поддерживает распознавание речи', 'error');
        startButton.disabled = true;
        stopButton.disabled = true;
    }
}); 