// Импорт внешних библиотек
document.write('<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>');
document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/particles.js/2.0.0/particles.min.js"></script>');

// Глобальная переменная для хранения текущего аудио
let currentAudio = null;

// Функция для проверки загрузки particles.js
function waitForParticles(callback) {
    if (window.particlesJS) {
        callback();
    } else {
        setTimeout(() => waitForParticles(callback), 50);
    }
}

// Функция инициализации particles.js
function initParticles() {
    particlesJS('particles-js', {
        particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: '#4a90e2' },
            shape: { type: 'circle' },
            opacity: { value: 0.5, random: false },
            size: { value: 3, random: true },
            line_linked: { enable: true, distance: 150, color: '#4a90e2', opacity: 0.4, width: 1 },
            move: { enable: true, speed: 3, direction: 'none', random: false, straight: false, out_mode: 'out' }
        },
        interactivity: {
            detect_on: 'canvas',
            events: {
                onhover: { enable: true, mode: 'repulse' },
                onclick: { enable: true, mode: 'push' },
                resize: true
            }
        },
        retina_detect: true
    });
}

// Функция воспроизведения аудио
function playAudio(src, button) {
    const icon = button.querySelector('i');
    
    // Если есть текущее аудио и это другой файл
    if (currentAudio && currentAudio.src !== src) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        const prevButton = document.querySelector('.fa-pause')?.parentElement;
        if (prevButton) {
            prevButton.querySelector('i').classList.remove('fa-pause');
            prevButton.querySelector('i').classList.add('fa-play');
        }
    }

    // Если это первое воспроизведение или новый файл
    if (!currentAudio || currentAudio.src !== src) {
        currentAudio = new Audio(src);
        currentAudio.addEventListener('ended', () => {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        });
    }

    // Воспроизведение/пауза
    if (currentAudio.paused) {
        currentAudio.play()
            .then(() => {
                icon.classList.remove('fa-play');
                icon.classList.add('fa-pause');
            })
            .catch(error => {
                console.error('Ошибка при воспроизведении аудио:', error);
                button.classList.add('disabled');
                button.disabled = true;
            });
    } else {
        currentAudio.pause();
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    waitForParticles(initParticles);
    
    // Добавляем обработчик для кнопки демонстрации
    document.getElementById('playDemoBtn').addEventListener('click', playDemo);
});

// Экспортируем функции
window.playAudio = playAudio;
window.playDemo = playDemo;

// Функция для демонстрационного плеера
function playDemo() {
    const container = document.querySelector('.dialog-container');
    const messages = [
        {
            type: 'user',
            sender: 'Пользователь',
            role: 'Запись голоса',
            audio: '/speech_examples/conversation_1_role_I_1.mp3',
            isRecording: true,
            audioMessageHtml: `
                <div class="audio-message">
                    <button class="play-button"><i class="fas fa-play"></i></button>
                    <div class="audio-waveform-container">
                        <div class="audio-waveform-placeholder"></div>
                        <div class="audio-progress-line"></div>
                    </div>
                    <span class="audio-duration">0:00</span>
                </div>
            `
        },
        {
            type: 'adobe-voice',
            sender: 'Adobe Voice',
            role: 'Транскрибация речи',
            text: 'Транскрипция: "Обрежь видео с 5 минуты по 10 минуту"'
        },
        {
            type: 'voice-command-api',
            sender: 'Voice Command API',
            role: 'Обработка команды',
            text: 'Обработка транскрипции и генерация команды',
            interpretation: '{"command": "cut", "parameters": {"start": 300, "end": 600}}'
        },
        {
            type: 'premiere-controller',
            sender: 'Premiere Controller',
            role: 'Выполнение в видеоредакторе',
            text: 'Выполнение команды обрезки видео',
            details: 'Параметры: start=5:00, end=10:00'
        }
    ];

    // Очищаем контейнер
    container.innerHTML = '';
    
    // Останавливаем текущее аудио если есть
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    // Показываем сообщения с анимацией
    messages.forEach((msg, index) => {
        setTimeout(() => {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${msg.type}`;
            
            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            
            // Устанавливаем разные иконки для разных типов сообщений
            if (msg.type === 'user') {
                avatar.innerHTML = '<i class="fas fa-user"></i>';
            } else if (msg.type === 'adobe-voice') {
                avatar.innerHTML = '<i class="fas fa-microphone"></i>';
            } else if (msg.type === 'voice-command-api') {
                avatar.innerHTML = '<i class="fas fa-code"></i>';
            } else if (msg.type === 'premiere-controller') {
                avatar.innerHTML = '<i class="fas fa-film"></i>';
            }
            
            const content = document.createElement('div');
            content.className = 'message-content';
            
            // Добавляем заголовок сообщения
            const header = document.createElement('div');
            header.className = 'message-header';
            
            const sender = document.createElement('span');
            sender.className = 'message-sender';
            sender.textContent = msg.sender;
            
            const role = document.createElement('span');
            role.className = 'message-role';
            role.textContent = msg.role;
            
            header.appendChild(sender);
            header.appendChild(role);
            content.appendChild(header);
            
            // Добавляем анимацию записи для первого сообщения
            if (msg.isRecording) {
                const recordingIndicator = document.createElement('div');
                recordingIndicator.className = 'recording-indicator';
                recordingIndicator.innerHTML = '<i class="fas fa-circle"></i>';
                content.appendChild(recordingIndicator);
            }
            
            // Добавляем либо аудиосообщение, либо обычный текст
            if (msg.audioMessageHtml) {
                 content.innerHTML += msg.audioMessageHtml; // Добавляем HTML аудиосообщения
            } else {
                const textEl = document.createElement('div');
                textEl.className = 'message-text';
                textEl.textContent = msg.text;
                content.appendChild(textEl);
            }
            
            if (msg.interpretation) {
                const interpretation = document.createElement('div');
                interpretation.className = 'message-interpretation';
                interpretation.textContent = msg.interpretation;
                content.appendChild(interpretation);
            }
            
            if (msg.details) {
                const details = document.createElement('div');
                details.className = 'message-details';
                details.textContent = msg.details;
                content.appendChild(details);
            }
            
            messageEl.appendChild(avatar);
            messageEl.appendChild(content);
            container.appendChild(messageEl);
            
            // Анимация появления
            setTimeout(() => messageEl.classList.add('show'), 100);
            
            // Воспроизведение аудио только для первого сообщения (пользователя с аудио)
            if (msg.audio && msg.type === 'user') {
                const audio = new Audio(msg.audio);
                const playButton = messageEl.querySelector('.play-button');
                const durationSpan = messageEl.querySelector('.audio-duration');
                 const progressLine = messageEl.querySelector('.audio-progress-line');

                // Обновляем длительность аудио после загрузки метаданных
                 audio.addEventListener('loadedmetadata', () => {
                    const minutes = Math.floor(audio.duration / 60);
                    const seconds = Math.floor(audio.duration % 60).toString().padStart(2, '0');
                    durationSpan.textContent = `${minutes}:${seconds}`;
                 });

                 // Обновляем прогресс воспроизведения и линию прогресса
                 audio.addEventListener('timeupdate', () => {
                     const currentMinutes = Math.floor(audio.currentTime / 60);
                     const currentSeconds = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
                     // Можно добавить обновление текущего времени, если нужно, но для простоты пока только обновим линию прогресса
                     // const currentTimeSpan = messageEl.querySelector('.audio-current-time'); // Если добавим span для текущего времени
                     // if (currentTimeSpan) currentTimeSpan.textContent = `${currentMinutes}:${currentSeconds}`;

                     const progress = (audio.currentTime / audio.duration) * 100;
                     progressLine.style.width = `${progress}%`;
                 });

                // Обработчик для кнопки воспроизведения/паузы
                playButton.addEventListener('click', () => {
                    const icon = playButton.querySelector('i');
                     // Останавливаем любое другое текущее аудио перед воспроизведением нового
                    if (currentAudio && currentAudio !== audio && !currentAudio.paused) {
                        currentAudio.pause();
                         // Сбрасываем иконку паузы на кнопке предыдущего аудио
                         const prevButtonIcon = document.querySelector('.audio-message .play-button i.fa-pause');
                         if(prevButtonIcon) {
                             prevButtonIcon.classList.remove('fa-pause');
                             prevButtonIcon.classList.add('fa-play');
                         }
                         // Сбрасываем линию прогресса предыдущего аудио
                          const prevProgressLine = document.querySelector('.audio-message .audio-progress-line');
                           if(prevProgressLine) {
                               prevProgressLine.style.width = '0%';
                           }
                    }

                    if (audio.paused) {
                        audio.play().then(() => {
                            icon.classList.remove('fa-play');
                            icon.classList.add('fa-pause');
                             currentAudio = audio; // Устанавливаем текущее воспроизводимое аудио
                        }).catch(error => {
                             console.error('Ошибка при воспроизведении аудио:', error);
                             playButton.classList.add('disabled');
                             playButton.disabled = true;
                        });
                    } else {
                        audio.pause();
                        icon.classList.remove('fa-pause');
                        icon.classList.add('fa-play');
                    }
                });

                 // Обработчик завершения воспроизведения
                 audio.addEventListener('ended', () => {
                    const icon = playButton.querySelector('i');
                    icon.classList.remove('fa-pause');
                    icon.classList.add('fa-play');
                     progressLine.style.width = '0%'; // Сброс линии прогресса
                 });
            }
        }, index * 3000); // Увеличиваем задержку между сообщениями
    });
} 