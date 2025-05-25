class VoiceCommandAPI {
    constructor() {
        this.isListening = false;
        this.recognition = null;
        this.commands = new Map();
        this.onCommandCallback = null;
        this.onErrorCallback = null;
        this.onStatusChangeCallback = null;
    }

    // Инициализация распознавания речи
    init() {
        if (!('webkitSpeechRecognition' in window)) {
            this._handleError('Ваш браузер не поддерживает распознавание речи');
            return false;
        }

        this.recognition = new webkitSpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'ru-RU';

        this.recognition.onstart = () => {
            this.isListening = true;
            this._updateStatus('Слушаю...');
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this._updateStatus('Ожидание команды...');
        };

        this.recognition.onerror = (event) => {
            this._handleError(`Ошибка распознавания: ${event.error}`);
        };

        this.recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            if (result.isFinal) {
                const command = result[0].transcript.toLowerCase().trim();
                this._processCommand(command);
            }
        };

        return true;
    }

    // Регистрация команды
    registerCommand(command, handler) {
        this.commands.set(command.toLowerCase(), handler);
    }

    // Начало прослушивания
    startListening() {
        if (this.recognition && !this.isListening) {
            this.recognition.start();
        }
    }

    // Остановка прослушивания
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    // Установка обработчика команд
    onCommand(callback) {
        this.onCommandCallback = callback;
    }

    // Установка обработчика ошибок
    onError(callback) {
        this.onErrorCallback = callback;
    }

    // Установка обработчика изменения статуса
    onStatusChange(callback) {
        this.onStatusChangeCallback = callback;
    }

    // Обработка команды
    _processCommand(command) {
        console.log('Распознана команда:', command);
        
        // Проверяем зарегистрированные команды
        for (const [registeredCommand, handler] of this.commands) {
            if (command.includes(registeredCommand)) {
                handler(command);
                if (this.onCommandCallback) {
                    this.onCommandCallback(command, registeredCommand);
                }
                return;
            }
        }

        // Если команда не распознана
        this._handleError('Команда не распознана');
    }

    // Обработка ошибок
    _handleError(message) {
        console.error('VoiceCommandAPI Error:', message);
        if (this.onErrorCallback) {
            this.onErrorCallback(message);
        }
    }

    // Обновление статуса
    _updateStatus(status) {
        console.log('VoiceCommandAPI Status:', status);
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback(status);
        }
    }
}

// Пример использования:
/*
const voiceAPI = new VoiceCommandAPI();

// Инициализация
if (voiceAPI.init()) {
    // Регистрация команд
    voiceAPI.registerCommand('обрезать', (command) => {
        console.log('Выполняется команда обрезки');
    });

    voiceAPI.registerCommand('удалить', (command) => {
        console.log('Выполняется команда удаления');
    });

    // Обработчики событий
    voiceAPI.onCommand((command, recognizedCommand) => {
        console.log(`Выполнена команда: ${command}`);
    });

    voiceAPI.onError((error) => {
        console.error(`Ошибка: ${error}`);
    });

    voiceAPI.onStatusChange((status) => {
        console.log(`Статус: ${status}`);
    });

    // Начало прослушивания
    voiceAPI.startListening();
}
*/ 