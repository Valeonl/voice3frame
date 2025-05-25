export class SoundEffects {
    constructor() {
        this.audioContext = null;
    }

    initialize() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    playStartSound() {
        if (!this.audioContext) this.initialize();
        
        // Создаем осциллятор для высокого звука "пик"
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Настраиваем звук начала записи (высокий тон)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime); // ля второй октавы
        
        // Настраиваем затухание
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.2);
        
        // Запускаем и останавливаем
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }

    playStopSound() {
        if (!this.audioContext) this.initialize();
        
        // Создаем два осциллятора для более богатого звука
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Первый осциллятор - восходящий тон
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, this.audioContext.currentTime);
        osc1.frequency.linearRampToValueAtTime(880, this.audioContext.currentTime + 0.15);
        
        // Второй осциллятор - дополнительный тон для гармонии
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(554.37, this.audioContext.currentTime + 0.1); // Нота До#
        
        // Настраиваем огибающую громкости
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + 0.15);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.25);
        
        // Запускаем и останавливаем осцилляторы
        osc1.start(this.audioContext.currentTime);
        osc2.start(this.audioContext.currentTime + 0.1);
        osc1.stop(this.audioContext.currentTime + 0.25);
        osc2.stop(this.audioContext.currentTime + 0.25);
    }
} 