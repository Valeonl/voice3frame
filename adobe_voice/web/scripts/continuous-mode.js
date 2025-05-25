export class ContinuousMode {
    constructor() {
        console.log('Инициализация непрерывного режима');
        this.isEnabled = false; // флаг готовности к работе (управляется чекбоксом)
        this.isActive = false;  // флаг активного состояния (управляется кнопкой микрофона)
        this.pauseDuration = 2000; // 2000 миллисекунд по умолчанию
        this.lastTextTime = 0;    // время последнего полученного текста
        this.pauseTimer = null;
        this.currentText = '';
        this.toggle = null;
        this.pauseInput = null;
        this.onPauseDetected = null;
        this.onStateChange = null;
        this.isPaused = false;  // новый флаг для отслеживания состояния паузы
        this.isFirstText = true;  // флаг для первого текста после паузы
        this.lastPauseText = '';  // текст, на котором последний раз была обнаружена пауза
    }

    initialize(toggle, pauseInput, onPauseDetected, onStateChange) {
        console.log('Инициализация непрерывного режима');
        this.toggle = toggle;
        this.pauseInput = pauseInput;
        this.onPauseDetected = onPauseDetected;
        this.onStateChange = onStateChange;
        
        this.toggle.checked = this.isEnabled;
        this.pauseInput.value = this.pauseDuration; // Теперь значение в миллисекундах
        console.log('Начальные значения: isEnabled =', this.isEnabled, 'pauseDuration =', this.pauseDuration, 'мс');

        this.toggle.addEventListener('change', () => {
            this.isEnabled = this.toggle.checked;
            console.log('Переключение режима: isEnabled =', this.isEnabled);
            if (!this.isEnabled) {
                this.deactivate();
            }
            
            document.querySelector('.continuous-mode').classList.remove('active');
            this.updateButtonState();
        });
        
        // Делаем поле редактируемым напрямую
        this.pauseInput.readOnly = false;
        
        // Обработчик изменения значения по Enter
        this.pauseInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const newValue = parseInt(this.pauseInput.value);
                if (!isNaN(newValue) && newValue > 0) {
                    this.pauseDuration = newValue; // Значение уже в миллисекундах
                    console.log('Установлена новая длительность паузы:', newValue, 'мс');
                } else {
                    // Если введено некорректное значение, возвращаем старое
                    this.pauseInput.value = this.pauseDuration;
                    console.log('Введено некорректное значение, возвращено:', this.pauseDuration, 'мс');
                }
                this.pauseInput.blur(); // Убираем фокус с поля
            }
        });

        // Обработчик потери фокуса для сохранения значения
        this.pauseInput.addEventListener('blur', () => {
            const newValue = parseInt(this.pauseInput.value);
            if (!isNaN(newValue) && newValue > 0) {
                this.pauseDuration = newValue; // Значение уже в миллисекундах
                console.log('Установлена новая длительность паузы при потере фокуса:', newValue, 'мс');
            } else {
                // Если введено некорректное значение, возвращаем старое
                this.pauseInput.value = this.pauseDuration;
                console.log('Введено некорректное значение, возвращено:', this.pauseDuration, 'мс');
            }
        });

        document.getElementById('continuousButton').addEventListener('click', (e) => {
            console.log('Клик по кнопке непрерывного режима');
            e.stopPropagation();
            const panel = document.querySelector('.continuous-mode');
            panel.classList.toggle('active');
            console.log('Панель непрерывного режима:', panel.classList.contains('active') ? 'показана' : 'скрыта');
        });

        document.addEventListener('click', (e) => {
            const panel = document.querySelector('.continuous-mode');
            const button = document.getElementById('continuousButton');
            if (!panel.contains(e.target) && !button.contains(e.target)) {
                panel.classList.remove('active');
                console.log('Панель непрерывного режима скрыта (клик вне панели)');
            }
        });
    }

    activate() {
        console.log('Попытка активации непрерывного режима');
        if (this.isEnabled && !this.isActive) {
            this.isActive = true;
            this.lastTextTime = Date.now();
            this.currentText = '';
            this.isPaused = false;
            this.isFirstText = true;
            this.lastPauseText = ''; // Сбрасываем текст последней паузы
            console.log('Непрерывный режим активирован');
            this.updateButtonState();
            if (this.onStateChange) {
                console.log('Вызов колбэка изменения состояния (активация)');
                this.onStateChange(true);
            }
        } else {
            console.log('Активация не выполнена: isEnabled =', this.isEnabled, 'isActive =', this.isActive);
        }
    }

    deactivate() {
        console.log('Попытка деактивации непрерывного режима');
        if (this.isActive) {
            this.isActive = false;
            this.clearPauseTimer();
            this.currentText = '';
            this.isPaused = false;
            this.isFirstText = true;
            console.log('Непрерывный режим деактивирован');
            this.updateButtonState();
            if (this.onStateChange) {
                console.log('Вызов колбэка изменения состояния (деактивация)');
                this.onStateChange(false);
            }
        } else {
            console.log('Деактивация не выполнена: isActive =', this.isActive);
        }
    }

    updateButtonState() {
        const button = document.getElementById('continuousButton');
        if (this.isEnabled) {
            button.classList.add('enabled');
            if (this.isActive) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        } else {
            button.classList.remove('enabled', 'active');
        }
        console.log('Обновлено состояние кнопки: enabled =', button.classList.contains('enabled'), 'active =', button.classList.contains('active'));
    }

    handleText(text) {
        if (!this.isActive) {
            console.log('Непрерывный режим не активен');
            return;
        }

        console.log('Обработка текста в непрерывном режиме:', text);
        const now = Date.now();
        
        // Если был на паузе, то новый текст - это начало новой фразы
        // Но мы не очищаем текст здесь, это делается в handleContinuousPause
        if (this.isPaused) {
            console.log('Получен новый текст после паузы');
            this.isPaused = false;
        }
        
        // Всегда обновляем текущий текст и время
        const oldText = this.currentText;
        this.currentText = text;
        this.lastTextTime = now;
        console.log('Обновлен текущий текст:', oldText, '->', this.currentText);
        
        this.clearPauseTimer();
        console.log('Таймер паузы очищен');
        
        // Устанавливаем таймер для проверки паузы
        console.log('Установка таймера паузы на', this.pauseDuration, 'мс');
        this.pauseTimer = setTimeout(() => {
            const timeSinceLastText = Date.now() - this.lastTextTime;
            console.log('Проверка паузы, прошло времени:', timeSinceLastText, 'мс');
            
            // Проверяем, что прошло достаточно времени и текст не изменился с момента последней паузы
            if (timeSinceLastText >= this.pauseDuration) {
                // Проверяем, не обрабатывали ли мы уже паузу для этого текста
                if (this.lastPauseText === this.currentText) {
                    console.log('Пропускаем обработку паузы, так как текст не изменился с последней паузы');
                    return;
                }
                
                this.isPaused = true;
                console.log('Обнаружена пауза');
                
                // Сохраняем текст, на котором произошла пауза
                this.lastPauseText = this.currentText;
                
                if (this.onPauseDetected) {
                    console.log('Вызов колбэка обнаружения паузы');
                    this.onPauseDetected();
                }
            } else {
                console.log('Пауза не обнаружена, прошло недостаточно времени');
            }
        }, this.pauseDuration);
    }

    clearPauseTimer() {
        if (this.pauseTimer) {
            clearTimeout(this.pauseTimer);
            this.pauseTimer = null;
            console.log('Таймер паузы очищен');
        }
    }

    isActiveMode() {
        return this.isActive;
    }

    isEnabledMode() {
        return this.isEnabled;
    }

    // Метод для получения текущей длительности паузы
    getPauseDuration() {
        return this.pauseDuration;
    }
} 