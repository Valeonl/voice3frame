export class UIController {
    constructor() {
        this.settingsModal = null;
        this.settingsButton = null;
        this.micButton = null;
        this.isProcessingEnd = false;
    }

    initialize(settingsButton, settingsModal, micButton) {
        this.settingsButton = settingsButton;
        this.settingsModal = settingsModal;
        this.micButton = micButton;

        this.setupListeners();
        this.preventDefaultButtonBehavior();

        // Добавляем стили для зеленого состояния
        const style = document.createElement('style');
        style.textContent = `
            .mic-button.processing {
                background-color: #34C759 !important;
                transform: scale(1.1);
                transition: all 0.2s ease-out;
            }
            .mic-button.processing i {
                animation: checkmark 0.2s ease-out forwards !important;
                color: white !important;
            }
            .mic-button.processing::before {
                display: none;
            }
            @keyframes checkmark {
                0% {
                    transform: scale(0.5) rotate(-45deg);
                    opacity: 0;
                }
                100% {
                    transform: scale(1) rotate(0);
                    opacity: 1;
                }
            }
            .mic-button i {
                font-size: 24px;
                color: white;
                transition: all 0.2s ease-out;
            }
            .mic-button.active i {
                animation: micPulse 1s infinite;
            }
            @keyframes micPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    setupListeners() {
        // Обработка клика по кнопке настроек
        this.settingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.settingsModal.classList.toggle('active');
        });

        // Закрытие модального окна при клике вне его
        document.addEventListener('click', (e) => {
            if (!this.settingsModal.contains(e.target) && !this.settingsButton.contains(e.target)) {
                this.settingsModal.classList.remove('active');
            }
        });
    }

    preventDefaultButtonBehavior() {
        // Предотвращаем активацию кнопок по Space и Enter при фокусе
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        });
    }

    updateMicButtonState(isListening, volume = 0) {
        if (!this.micButton) return;

        if (this.isProcessingEnd) return;

        if (isListening) {
            this.micButton.classList.add('active');
            this.micButton.style.setProperty('--pulse-scale', 1 + Math.min(volume * 2, 0.5));
        } else {
            this.micButton.classList.remove('active');
            this.micButton.style.setProperty('--pulse-scale', '1');
        }
    }

    async showProcessingState() {
        if (!this.micButton) return;

        this.isProcessingEnd = true;
        
        // Убираем красный цвет и добавляем зеленый
        this.micButton.classList.remove('active');
        this.micButton.classList.add('processing');
        
        // Меняем иконку на галочку с анимацией
        this.micButton.innerHTML = '<i class="fas fa-check"></i>';
        
        // Ждем 500мс для отображения зеленого состояния
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Убираем зеленый цвет и возвращаем обычное состояние с плавной анимацией
        this.micButton.style.transition = 'all 0.3s ease-out';
        this.micButton.classList.remove('processing');
        this.micButton.innerHTML = '<i class="fas fa-microphone"></i>';
        
        this.isProcessingEnd = false;
    }

    closeSettingsModal() {
        this.settingsModal.classList.remove('active');
    }
} 