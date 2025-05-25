import { SpeechRecognizer } from './recognition.js';
import { VolumeAnalyzer } from './volume-analyzer.js';
import { HotkeyManager } from './hotkeys.js';
import { UIController } from './ui-controls.js';
import { SoundEffects } from './sound-effects.js';
import { ContinuousMode } from './continuous-mode.js';

class VoiceApp {
    constructor() {
        console.log('Инициализация VoiceApp');
        this.isListening = false;
        this.recognizer = new SpeechRecognizer();
        this.volumeAnalyzer = new VolumeAnalyzer();
        this.hotkeyManager = new HotkeyManager();
        this.uiController = new UIController();
        this.soundEffects = new SoundEffects();
        this.continuousMode = new ContinuousMode();
        this.transcriptionElement = null;
        this.textHistory = [];
        this.currentHistoryIndex = -1;
        this.originalText = '';
        this.lastSentCommand = '';
        this.commandStartTime = 0; // Время начала записи команды
        this.lastCommandStartTime = 0; // Время начала последней отправленной команды
        this.isProcessingPause = false; // Флаг обработки паузы
    }

    initialize() {
        console.log('Инициализация компонентов приложения');
        // Получаем все необходимые элементы UI
        const micButton = document.getElementById('micButton');
        this.transcriptionElement = document.getElementById('transcription');
        console.log('Элемент transcription найден:', !!this.transcriptionElement);
        const settingsButton = document.querySelector('.settings-button');
        const settingsModal = document.querySelector('.settings-modal');
        const hotkeyInput = document.querySelector('.hotkey-input');
        const hotkeyHint = document.querySelector('.hotkey-hint');
        const textControls = document.querySelector('.text-controls');
        const undoButton = document.getElementById('undoButton');
        const redoButton = document.getElementById('redoButton');
        const resendButton = document.getElementById('resendButton');
        const continuousToggle = document.getElementById('continuousToggle');
        const pauseDurationInput = document.getElementById('pauseDurationInput');

        // Делаем текст изначально нередактируемым
        this.transcriptionElement.contentEditable = 'false';

        // Инициализируем компоненты
        this.uiController.initialize(settingsButton, settingsModal, micButton);
        this.hotkeyManager.initialize(hotkeyInput, hotkeyHint, () => this.toggleListening());
        
        // Инициализация распознавания речи с разделением логики по режимам
        this.recognizer.initialize((text, isFinal) => {
            console.log('Получен текст:', text, 'финальный:', isFinal);
            
            // НЕПРЕРЫВНЫЙ РЕЖИМ
            if (this.continuousMode.isActiveMode()) {
                console.log('Обработка текста в непрерывном режиме');
                
                // Больше не очищаем текст здесь, это делается в handleContinuousPause
                // Просто обрабатываем текст через ContinuousMode для отслеживания пауз
                this.continuousMode.handleText(text);
                
                // В непрерывном режиме всегда заменяем весь текст
                this.transcriptionElement.textContent = text;
                console.log('Текст обновлен в непрерывном режиме:', this.transcriptionElement.textContent);
            } 
            // ОБЫЧНЫЙ РЕЖИМ
            else {
                console.log('Обработка текста в обычном режиме');
                // В обычном режиме просто отображаем полный текст (с накоплением)
                // Текст уже накапливается в SpeechRecognizer (finalText + interimText)
                this.updateTranscriptionNormal(text);
            }
        });
        
        this.soundEffects.initialize();
        this.continuousMode.initialize(continuousToggle, pauseDurationInput, 
            () => {
                // Когда обнаружена пауза в непрерывном режиме
                this.handleContinuousPause();
            },
            (isActive) => {
                // Когда изменяется состояние непрерывного режима
                if (!isActive && this.isListening) {
                    this.stopListening();
                }
            }
        );

        // Добавляем обработчики для редактирования текста
        this.transcriptionElement.addEventListener('input', () => {
            this.handleTextChange();
        });

        this.transcriptionElement.addEventListener('focus', () => {
            this.hotkeyManager.setEnabled(false);
        });

        this.transcriptionElement.addEventListener('blur', () => {
            this.hotkeyManager.setEnabled(true);
        });

        // Обработчики для кнопок управления
        undoButton.addEventListener('click', () => this.undo());
        redoButton.addEventListener('click', () => this.redo());
        resendButton.addEventListener('click', () => this.resendText());

        // Добавляем обработчик клика на кнопку микрофона
        micButton.addEventListener('click', () => {
            console.log('Клик по кнопке микрофона');
            if (this.continuousMode.isEnabledMode()) {
                console.log('Непрерывный режим включен');
                if (!this.isListening) {
                    console.log('Активация непрерывного режима');
                    this.continuousMode.activate();
                    this.startListening();
                } else {
                    console.log('Деактивация непрерывного режима');
                    this.continuousMode.deactivate();
                    this.stopListening();
                }
            } else {
                console.log('Переключение обычного режима');
                this.toggleListening();
            }
        });
    }

    handleTextChange() {
        const currentContent = this.transcriptionElement.innerHTML;
        
        // Если содержимое изменилось
        if (currentContent !== this.originalText) {
            const resendButton = document.getElementById('resendButton');
            resendButton.classList.add('active');
        }

        // Добавляем изменение в историю
        this.currentHistoryIndex++;
        this.textHistory.splice(this.currentHistoryIndex);
        this.textHistory.push(currentContent);

        // Обновляем состояние кнопок
        this.updateControlButtons();
    }

    undo() {
        if (this.currentHistoryIndex > 0) {
            this.currentHistoryIndex--;
            this.transcriptionElement.innerHTML = this.textHistory[this.currentHistoryIndex];
            this.updateControlButtons();
        }
    }

    redo() {
        if (this.currentHistoryIndex < this.textHistory.length - 1) {
            this.currentHistoryIndex++;
            this.transcriptionElement.innerHTML = this.textHistory[this.currentHistoryIndex];
            this.updateControlButtons();
        }
    }

    updateControlButtons() {
        const undoButton = document.getElementById('undoButton');
        const redoButton = document.getElementById('redoButton');

        undoButton.disabled = this.currentHistoryIndex <= 0;
        redoButton.disabled = this.currentHistoryIndex >= this.textHistory.length - 1;
    }

    resendText() {
        // Получаем только текст команды, без HTML-разметки
        const text = this.transcriptionElement.textContent;
        console.log('Отправка текста:', text);
        this.sendCommand(text);
        
        // Сбрасываем состояние кнопки
        const resendButton = document.getElementById('resendButton');
        resendButton.classList.remove('active');
    }

    // Метод для отправки команды в Python
    async sendCommand(text) {
        // Формируем словарь с метаданными
        const commandEndTime = Date.now();
        const pauseDuration = this.continuousMode.isActiveMode() ? this.continuousMode.getPauseDuration() : 0;
        
        // Проверяем, не отправляли ли мы уже команду с таким же временем начала
        // Это предотвращает дублирование команд в рамках одной сессии распознавания
        if (this.commandStartTime === this.lastCommandStartTime) {
            console.log('Команда с таким же временем начала уже была отправлена, пропускаем:', text);
            return true;
        }
        
        // Сохраняем время начала отправляемой команды для будущих проверок
        this.lastCommandStartTime = this.commandStartTime;
        
        const commandData = {
            start_time: this.commandStartTime,
            end_time: commandEndTime,
            duration_ms: commandEndTime - this.commandStartTime,
            pause_duration_ms: pauseDuration,
            duration_without_pause_ms: commandEndTime - this.commandStartTime - pauseDuration,
            recognition_type: this.continuousMode.isActiveMode() ? 'continuous' : 'simple',
            text: text
        };
        
        console.log('Отправка команды в Python:', commandData);
        
        // Отправляем команду асинхронно, но не ждем ответа
        // Это позволит пользователю продолжать работу, не блокируя интерфейс
        eel.send_command(commandData)().then(result => {
            console.log('Результат отправки команды:', result);
            
            // Логируем результаты обработки API только в консоль
            if (result && result.api_result) {
                console.log('Результат обработки API:');
                console.log('Статус:', result.api_result.status);
                console.log('Время обработки:', result.api_result.processing_time);
                
                // Выводим JSON-ответ только в консоль
                if (result.api_result.response && result.api_result.response.response) {
                    console.log('Ответ API:', result.api_result.response.response);
                }
            }
        }).catch(error => {
            console.error('Ошибка при отправке команды:', error);
        });
        
        // Сразу возвращаем успех, не дожидаясь ответа от API
        return { status: 'success', message: 'Команда отправлена' };
    }

    async handleContinuousPause() {
        console.log('Обработка паузы в непрерывном режиме');
        
        // Проверяем, не обрабатывается ли уже пауза
        if (this.isProcessingPause) {
            console.log('Пауза уже обрабатывается, пропускаем');
            return;
        }
        
        // Устанавливаем флаг обработки паузы
        this.isProcessingPause = true;
        
        try {
            // Сохраняем текущий текст
            const currentText = this.transcriptionElement.textContent;
            console.log('Сохраненный текст в непрерывном режиме:', currentText);
            
            // Отправляем команду в Python
            const result = await this.sendCommand(currentText);
            
            // Воспроизводим звук завершения
            if (result && result !== true) {
                this.soundEffects.playStopSound();
                console.log('Звук завершения воспроизведен после отправки команды');
                
                // Добавляем эффект успешного завершения для текста
                this.transcriptionElement.classList.add('success');
            }
            
            // Очищаем текст сразу после отправки команды
            // Это предотвратит добавление нового текста к старому
            setTimeout(() => {
                // Очищаем текст с анимацией
                this.transcriptionElement.classList.add('fade-out');
                
                setTimeout(() => {
                    // Полностью очищаем содержимое элемента
                    while (this.transcriptionElement.firstChild) {
                        this.transcriptionElement.removeChild(this.transcriptionElement.firstChild);
                    }
                    
                    this.transcriptionElement.classList.remove('success', 'fade-out');
                    this.transcriptionElement.classList.add('fade-in');
                    console.log('Текст очищен после паузы');
                    
                    // Сбрасываем накопленный текст в распознавателе
                    this.recognizer.resetText();
                    console.log('Накопленный текст в распознавателе сброшен');
                    
                    // Обновляем время начала новой команды
                    this.commandStartTime = Date.now();
                    console.log('Обновлено время начала записи команды:', new Date(this.commandStartTime).toISOString());
                    
                    // Сбрасываем флаг обработки паузы
                    this.isProcessingPause = false;
                }, 300);
            }, 1000); // Уменьшаем задержку перед очисткой, так как не ждем ответа от API
        } catch (error) {
            console.error('Ошибка при обработке паузы:', error);
            // Сбрасываем флаг обработки паузы в случае ошибки
            this.isProcessingPause = false;
        }
    }

    async toggleListening() {
        console.log('Переключение состояния прослушивания');
        if (this.isListening) {
            await this.stopListening();
        } else {
            await this.startListening();
        }
    }

    async startListening() {
        console.log('Начало прослушивания');
        const success = this.recognizer.start();
        console.log('Результат запуска распознавания:', success);
        if (!success) return;

        // Сбрасываем последнюю отправленную команду при начале нового прослушивания
        this.lastSentCommand = '';
        
        // Запоминаем время начала записи команды
        this.commandStartTime = Date.now();
        console.log('Запомнено время начала записи команды:', new Date(this.commandStartTime).toISOString());

        this.soundEffects.playStartSound();
        console.log('Звук начала воспроизведен');

        // Очищаем текст при старте в любом режиме
        this.transcriptionElement.classList.add('fade-out');
        this.transcriptionElement.contentEditable = 'false';
        document.querySelector('.text-controls').classList.remove('visible');
        console.log('Подготовка UI для начала распознавания');
        
        await new Promise(resolve => setTimeout(resolve, 300));
        this.transcriptionElement.textContent = '';
        console.log('Текст очищен перед началом распознавания');
        this.transcriptionElement.classList.remove('success', 'fade-out');
        this.transcriptionElement.classList.add('fade-in');

        // Сбрасываем историю только в обычном режиме
        if (!this.continuousMode.isActiveMode()) {
            console.log('Сброс истории текста в обычном режиме');
            this.textHistory = [];
            this.currentHistoryIndex = -1;
        }

        await this.volumeAnalyzer.start((volume) => {
            this.uiController.updateMicButtonState(true, volume);
        });
        console.log('Анализатор громкости запущен');

        this.isListening = true;
        console.log('Состояние прослушивания установлено в true');
    }

    async stopListening() {
        console.log('Остановка прослушивания');
        if (!this.isListening) {
            console.log('Прослушивание уже остановлено');
            return;
        }

        this.recognizer.stop();
        console.log('Распознавание остановлено');
        this.volumeAnalyzer.stop();
        console.log('Анализатор громкости остановлен');
        this.isListening = false;
        console.log('Состояние прослушивания установлено в false');
        
        if (!this.continuousMode.isActiveMode()) {
            console.log('Завершение в обычном режиме');
            
            // Делаем текст редактируемым
            this.transcriptionElement.contentEditable = 'true';
            
            // Сохраняем оригинальный текст
            this.originalText = this.transcriptionElement.textContent;
            console.log('Сохранен оригинальный текст:', this.originalText);
            
            // Если есть текст, отправляем команду
            if (this.originalText.trim()) {
                console.log('Отправка команды в обычном режиме:', this.originalText);
                const result = await this.sendCommand(this.originalText);
                
                // Воспроизводим звук завершения
                if (result && result !== true) {
                    this.soundEffects.playStopSound();
                    console.log('Звук завершения воспроизведен после отправки команды');
                    
                    // Добавляем эффект успешного завершения для текста
                    this.transcriptionElement.classList.add('success');
                }
            } else {
                console.log('Текст пустой, команда не отправлена');
            }
            
            // Показываем кнопки управления
            document.querySelector('.text-controls').classList.add('visible');
            console.log('UI обновлен для режима редактирования');
            
            this.textHistory = [this.originalText];
            this.currentHistoryIndex = 0;
            this.updateControlButtons();
            
            await this.uiController.showProcessingState();
            console.log('Показано состояние обработки');
        } else {
            console.log('Завершение в непрерывном режиме (без изменения UI)');
        }
    }

    // Метод для обновления текста в обычном режиме
    updateTranscriptionNormal(text) {
        if (!this.transcriptionElement) {
            console.log('Элемент transcription не найден');
            return;
        }
        
        if (!text.trim()) {
            console.log('Получен пустой текст');
            return;
        }
        
        console.log('Обновление текста в обычном режиме:', text);
        
        // В обычном режиме просто заменяем текст с анимацией
        this.transcriptionElement.classList.remove('fade-in');
        this.transcriptionElement.classList.add('fade-out');
        
        setTimeout(() => {
            this.transcriptionElement.textContent = text;
            this.transcriptionElement.classList.remove('fade-out');
            this.transcriptionElement.classList.add('fade-in');
            console.log('Текст обновлен в обычном режиме:', this.transcriptionElement.textContent);
        }, 150);
    }
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const app = new VoiceApp();
    app.initialize();
}); 