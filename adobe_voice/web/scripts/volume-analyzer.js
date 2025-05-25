export class VolumeAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.animationId = null;
        this.onVolumeChange = null;
    }

    async start(onVolumeChange) {
        this.onVolumeChange = onVolumeChange;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.initializeAnalyzer(stream);
            return true;
        } catch (err) {
            console.error('Ошибка доступа к микрофону:', err);
            return false;
        }
    }

    initializeAnalyzer(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.microphone = this.audioContext.createMediaStreamSource(stream);
        
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.3;
        this.microphone.connect(this.analyser);

        this.startAnalysis();
    }

    startAnalysis() {
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        const updateVolume = () => {
            this.analyser.getByteFrequencyData(dataArray);
            
            let sum = 0;
            const voiceRange = dataArray.slice(2, 8);
            for (let value of voiceRange) {
                sum += value;
            }
            const volume = sum / (voiceRange.length * 255);
            
            if (this.onVolumeChange) {
                this.onVolumeChange(volume);
            }
            
            this.animationId = requestAnimationFrame(updateVolume);
        };
        
        updateVolume();
    }

    stop() {
        if (this.audioContext) {
            this.microphone?.disconnect();
            cancelAnimationFrame(this.animationId);
        }
    }
} 