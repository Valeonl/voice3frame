export class SpeechRecognizer {
    constructor() {
        console.log('Инициализация SpeechRecognizer');
        this.recognition = null;
        this.isListening = false;
        this.onTextCallback = null;
        this.lastText = '';
        this.finalText = '';
        this.interimText = '';
    }

    initialize(onTextCallback) {
        console.log('Инициализация распознавания речи');
        this.onTextCallback = onTextCallback;

        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.error('API распознавания речи не поддерживается в этом браузере');
                return false;
            }

            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'ru-RU';
            this.recognition.interimResults = true;
            this.recognition.continuous = true;
            console.log('Объект распознавания речи создан успешно');

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                        console.log('Получен финальный результат:', transcript);
                    } else {
                        interimTranscript += transcript;
                        console.log('Получен промежуточный результат:', transcript);
                    }
                }

                if (finalTranscript) {
                    this.finalText += finalTranscript + ' ';
                    console.log('Обновлен финальный текст:', this.finalText);
                }
                this.interimText = interimTranscript;
                
                const fullText = this.finalText + this.interimText;
                
                if (fullText !== this.lastText) {
                    console.log('Текст изменился, отправляем колбэк:', fullText);
                    this.lastText = fullText;
                    this.onTextCallback(fullText, finalTranscript ? true : false);
                } else {
                    console.log('Текст не изменился:', fullText);
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Ошибка распознавания речи:', event.error);
            };

            this.recognition.onend = () => {
                console.log('Сессия распознавания завершена');
                if (this.isListening) {
                    console.log('Перезапуск распознавания...');
                    this.recognition.start();
                }
            };

            return true;
        } catch (error) {
            console.error('Ошибка при инициализации распознавания речи:', error);
            return false;
        }
    }

    start() {
        console.log('Запуск распознавания речи');
        if (!this.recognition) {
            console.error('Распознавание речи не инициализировано');
            return false;
        }

        try {
            this.recognition.start();
            this.isListening = true;
            this.lastText = '';
            this.finalText = '';
            this.interimText = '';
            console.log('Распознавание речи запущено успешно');
            return true;
        } catch (error) {
            console.error('Ошибка при запуске распознавания речи:', error);
            return false;
        }
    }

    stop() {
        console.log('Остановка распознавания речи');
        if (!this.recognition || !this.isListening) {
            console.log('Распознавание речи не запущено');
            return;
        }

        try {
            this.recognition.stop();
            this.isListening = false;
            console.log('Распознавание речи остановлено успешно');
        } catch (error) {
            console.error('Ошибка при остановке распознавания речи:', error);
        }
    }

    // Метод для сброса накопленного текста
    resetText() {
        console.log('Сброс накопленного текста в распознавателе');
        this.finalText = '';
        this.interimText = '';
        this.lastText = '';
    }
} 