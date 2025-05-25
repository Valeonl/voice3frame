class VideoPlayer {
    constructor(container, options = {}) {
        this.container = container;
        this.video = container.querySelector('video');
        this.progressBar = container.querySelector('.progress-bar');
        this.progressFill = container.querySelector('.progress-fill');
        this.timeMarks = container.querySelector('.time-marks');
        this.playPauseBtn = container.querySelector('.play-pause-btn');
        this.replayOverlay = container.querySelector('.replay-overlay');
        this.replayButton = container.querySelector('.replay-button');
        this.soundHint = container.querySelector('.sound-hint');
        
        // Параметры по умолчанию
        this.options = {
            autoplay: true,
            muted: true,
            ...options
        };
        
        this.init();
    }

    init() {
        // Предзагрузка видео
        this.video.preload = 'auto';
        this.video.muted = this.options.muted;

        // Обработчики событий
        this.video.addEventListener('loadedmetadata', () => this.generateTimeMarks());
        this.video.addEventListener('timeupdate', () => this.updateProgress());
        this.video.addEventListener('ended', () => this.showReplayOverlay());
        this.video.addEventListener('click', () => this.togglePlay());
        this.progressBar.addEventListener('click', (e) => this.seek(e));
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.replayButton.addEventListener('click', () => this.replay());

        // Обработчики для звука
        this.container.addEventListener('mouseenter', () => {
            if (!this.video.ended) {
                this.video.muted = false;
                this.soundHint.style.opacity = '0';
            }
        });
        
        this.container.addEventListener('mouseleave', () => {
            if (!this.video.ended) {
                this.video.muted = true;
                this.soundHint.style.opacity = '1';
            }
        });

        // Добавляем обработчик для автозапуска при прокрутке
        if (this.options.autoplay) {
            window.addEventListener('scroll', () => this.handleScroll());
            // Начальная проверка
            this.handleScroll();
        }

        // Начальное состояние
        this.updatePlayPauseButton();
    }

    handleScroll() {
        if (this.isElementInViewport(this.container)) {
            this.video.play();
        } else {
            this.video.pause();
        }
    }

    isElementInViewport(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    generateTimeMarks() {
        const duration = this.video.duration;
        const interval = Math.ceil(duration / 4); // Разделим видео на 4 части
        this.timeMarks.innerHTML = ''; // Очищаем существующие метки

        // Создаем метки для каждого интервала
        for (let i = 0; i <= 4; i++) {
            const time = Math.floor(i * interval);
            const minutes = Math.floor(time / 60);
            const seconds = time % 60;
            const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            const mark = document.createElement('span');
            mark.className = 'time-mark';
            mark.textContent = timeString;
            this.timeMarks.appendChild(mark);
        }
    }

    updateProgress() {
        const progress = (this.video.currentTime / this.video.duration) * 100;
        this.progressFill.style.width = `${progress}%`;
        
        // Обновление временных меток
        const timeMarks = this.timeMarks.querySelectorAll('.time-mark');
        timeMarks.forEach(mark => {
            const [minutes, seconds] = mark.textContent.split(':').map(Number);
            const markTime = minutes * 60 + seconds;
            if (this.video.currentTime >= markTime - 0.5) {
                mark.classList.add('active');
            } else {
                mark.classList.remove('active');
            }
        });
    }

    seek(e) {
        const rect = this.progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        this.video.currentTime = pos * this.video.duration;
    }

    togglePlay() {
        if (this.video.paused) {
            this.video.play();
        } else {
            this.video.pause();
        }
        this.updatePlayPauseButton();
    }

    updatePlayPauseButton() {
        const icon = this.playPauseBtn.querySelector('i');
        if (this.video.paused) {
            icon.className = 'fas fa-play';
        } else {
            icon.className = 'fas fa-pause';
        }
    }

    showReplayOverlay() {
        this.replayOverlay.classList.add('visible');
        this.soundHint.style.display = 'none';
    }

    replay() {
        this.video.currentTime = 0;
        this.video.play();
        this.replayOverlay.classList.remove('visible');
        this.soundHint.style.display = 'flex';
        this.updatePlayPauseButton();
    }
}

// Инициализация всех видео-плееров на странице
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.video-player-container').forEach(container => {
        new VideoPlayer(container, {
            autoplay: true, // Включаем автозапуск по умолчанию
            muted: true    // Включаем беззвучный режим по умолчанию
        });
    });
}); 