export class HotkeyManager {
    constructor() {
        this.currentHotkey = 'Space';
        this.isSettingHotkey = false;
        this.onHotkeyPress = null;
        this.hotkeyInput = null;
        this.hotkeyHint = null;
        this.isEnabled = true;
    }

    initialize(hotkeyInput, hotkeyHint, onHotkeyPress) {
        this.hotkeyInput = hotkeyInput;
        this.hotkeyHint = hotkeyHint;
        this.onHotkeyPress = onHotkeyPress;

        // Устанавливаем начальное значение
        this.hotkeyInput.value = this.currentHotkey;

        this.setupListeners();
    }

    setupListeners() {
        // Активация режима назначения клавиши при клике на поле
        this.hotkeyInput.addEventListener('click', () => {
            this.isSettingHotkey = true;
            this.hotkeyInput.classList.add('listening');
            this.hotkeyHint.classList.add('active');
            this.hotkeyInput.value = 'Нажмите клавишу';
        });

        // Обработка ввода горячей клавиши
        this.hotkeyInput.addEventListener('keydown', (e) => {
            if (!this.isSettingHotkey) return;
            e.preventDefault();
            e.stopPropagation();

            if (e.key === 'Escape') {
                this.cancelHotkeySet();
                return;
            }
            
            const key = e.key === ' ' ? 'Space' : e.key;
            this.setHotkey(key);
        });

        // Единый обработчик нажатий клавиш
        document.addEventListener('keydown', (e) => {
            if (this.isSettingHotkey) return;
            if (!this.isEnabled) return;
            
            // Проверяем, не находится ли фокус в редактируемом элементе
            const activeElement = document.activeElement;
            if (activeElement && 
                (activeElement.contentEditable === 'true' || 
                 activeElement.tagName === 'INPUT' || 
                 activeElement.tagName === 'TEXTAREA')) {
                return;
            }
            
            const pressedKey = e.key === ' ' ? 'Space' : e.key;
            if (pressedKey === this.currentHotkey) {
                e.preventDefault();
                if (this.onHotkeyPress) {
                    this.onHotkeyPress();
                }
            }
        });
    }

    setHotkey(key) {
        this.currentHotkey = key;
        this.hotkeyInput.value = key;
        this.hotkeyInput.classList.remove('listening');
        this.hotkeyHint.classList.remove('active');
        this.isSettingHotkey = false;
    }

    cancelHotkeySet() {
        this.isSettingHotkey = false;
        this.hotkeyInput.value = this.currentHotkey;
        this.hotkeyInput.classList.remove('listening');
        this.hotkeyHint.classList.remove('active');
    }

    getCurrentHotkey() {
        return this.currentHotkey;
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
    }
} 