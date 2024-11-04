import React, { useState, useRef, useEffect } from 'react';
import '../styles/MicrophoneButton.css';
import useRecordingsStore from '../store/RecordingsStore';
import useAudioPlayerStore from '../store/AudioPlayerStore';

const MicrophoneButton = ({ onTranscriptionReceived, onNotification, recognitionModel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHotkeyMenu, setShowHotkeyMenu] = useState(false);
  const [currentHotkey, setCurrentHotkey] = useState({ key: 'Space', label: 'Пробел' });
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const currentAudio = useRef(null);
  const pressTimer = useRef(null);
  const minPressTime = 80; // Увеличим минимальное время удержания
  const isKeyPressed = useRef(false);
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const lastKeyPress = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { playAudio, stopAudio, isPlayingFile, currentFileName } = useAudioPlayerStore();

  const AVAILABLE_HOTKEYS = [
    { key: 'Space', label: 'Пробел' },
    { key: 'ShiftLeft', label: 'Левый Shift' },
    { key: 'ControlLeft', label: 'Левый Control' },
    { key: 'AltLeft', label: 'Левый Alt' },
    { key: 'KeyR', label: 'R' }
  ];

  const autoPlayRef = useRef(autoPlay);

  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  const startRecording = async () => {
    if (!isKeyPressed.current) {
      return; // Не начинаем запись, если клавиша не удерживается
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          sampleSize: 16
        } 
      });
      
      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        await sendAudioToServer(audioBlob);
        setIsProcessing(false);
      };

      mediaRecorder.current.start(100);
      setIsRecording(true);
    } catch (error) {
      console.error('Ошибка при записи:', error);
      onTranscriptionReceived("Ошибка доступа к микрофону");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const playLastRecording = async () => {
    try {
      // Если что-то уже играет - останавливаем
      if (currentFileName) {
        stopAudio();
        return;
      }

      const response = await fetch('http://localhost:5000/api/recordings/latest');
      if (response.ok) {
        const data = await response.json();
        if (data.exists && data.filename) {
          const audio = new Audio(`http://localhost:5000/api/recordings/play/${data.filename}`);
          
          audio.onerror = (e) => {
            console.error('Ошибка воспроизведения:', e);
            onNotification({
              message: 'Ошибка воспроизведения',
              type: 'error'
            });
            stopAudio();
          };

          // Запускаем воспроизведение
          playAudio(audio, data.filename);

        } else {
          onNotification({
            message: 'Отсутствуют аудиозаписи для проигрывания',
            type: 'warning'
          });
        }
      } else {
        onNotification({
          message: 'Отсутствуют аудиозаписи для проигрывания',
          type: 'warning'
        });
      }
    } catch (error) {
      console.error('Ошибка при воспроизведении:', error);
      onNotification({
        message: 'Ошибка при воспроизведении',
        type: 'error'
      });
      stopAudio();
    }
  };

  const addRecording = useRecordingsStore(state => state.addRecording);
  const updateRecording = useRecordingsStore(state => state.updateRecording);
  const removeRecording = useRecordingsStore(state => state.removeRecording);

  const sendAudioToServer = async (audioBlob) => {
    const timestamp = new Date().toISOString();
    const tempFilename = `recording_${timestamp.replace(/[:.]/g, '')}.wav`;
    
    // Создаем временную запись
    const newRecording = {
      filename: tempFilename,
      timestamp: new Date().toLocaleString(),
      duration: 0,
      path: tempFilename,
      processing: true,
      isTemp: true
    };
    
    addRecording(newRecording);
    onTranscriptionReceived('Идет распознавание...');
    
    if (onNotification) {
      onNotification({
        message: 'Обработка записи...',
        type: 'success'
      });
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, tempFilename);

    try {
      console.log('Отправка запроса с методом:', recognitionModel);
      const response = await fetch(`http://localhost:5000/api/process-audio?method=${recognitionModel}`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        // Обновляем запись с начальными данными
        updateRecording(tempFilename, { 
          filename: data.filename,
          processing: true,
          isTemp: false,
          transcription: data.text,
          duration: data.duration
        });

        // Запускаем проверку статуса распознавания
        const checkStatus = async () => {
          try {
            const statusResponse = await fetch(`http://localhost:5000/api/recordings/status/${data.filename}`);
            const statusData = await statusResponse.json();

            if (statusData.success) {
              if (statusData.status === 'completed') {
                // Обновляем запись с финальными данными
                updateRecording(data.filename, {
                  processing: false,
                  transcription: statusData.transcription
                });
                onTranscriptionReceived(statusData.transcription);
                return;
              } else if (statusData.status === 'error') {
                throw new Error('Ошибка распознавания');
              }
            }

            // Продолжаем проверять статус
            setTimeout(checkStatus, 1000);
          } catch (error) {
            console.error('Ошибка при проверке статуса:', error);
            onNotification({
              message: 'Ошибка при распознавании',
              type: 'error'
            });
          }
        };

        // Начинаем проверку статуса
        checkStatus();

        // Воспроизводим, если включено
        if (autoPlayRef.current) {
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.onended = () => URL.revokeObjectURL(audioUrl);
          await audio.play();
        }
      } else {
        throw new Error(data.details || data.error || 'Ошибка обработки файла');
      }
    } catch (error) {
      console.error('Ошибка при отправке аудио:', error);
      if (onNotification) {
        onNotification({
          message: error.message || 'Ошибка при обработке записи',
          type: 'error'
        });
      }
      removeRecording(tempFilename);
      onTranscriptionReceived('Ошибка при распознавании речи');
    }
  };

  // Преобразование кода клавиши в читаемую метку
  const getKeyLabel = (event) => {
    let label = '';
    if (event.ctrlKey) label += 'Ctrl + ';
    if (event.altKey) label += 'Alt + ';
    if (event.shiftKey) label += 'Shift + ';
    
    // Специальные клавиши
    const specialKeys = {
      ' ': 'Пробел',
      'Control': '',  // Не добавляем, т.к. уже добавлено выше
      'Shift': '',
      'Alt': '',
      'Enter': 'Enter',
      'Backspace': 'Backspace',
      'Delete': 'Delete',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'Tab': 'Tab',
      'CapsLock': 'CapsLock',
      'Escape': 'Escape'
    };

    const key = event.key;
    label += specialKeys[key] || key.toUpperCase();
    return label;
  };

  // Получение кода комбинации клавиш
  const getHotkeyCode = (event) => {
    let code = '';
    if (event.ctrlKey) code += 'Control+';
    if (event.altKey) code += 'Alt+';
    if (event.shiftKey) code += 'Shift+';
    code += event.code;
    return code;
  };

  // Обработчик записи новой горячей клавиши
  const handleKeyDown = (e) => {
    if (isRecordingHotkey) {
      e.preventDefault();
      
      // Игнорируем отдельные нажатия модификаторов
      if (['Control', 'Alt', 'Shift'].includes(e.key)) {
        return;
      }

      const hotkeyCode = getHotkeyCode(e);
      const hotkeyLabel = getKeyLabel(e);

      // Сначала обновляем горячую клавишу
      setCurrentHotkey({
        key: hotkeyCode,
        label: hotkeyLabel
      });
      setIsRecordingHotkey(false);

      // Добавляем класс для анимации исчезновения
      const menu = document.getElementById('hotkeyMenu');
      menu.classList.add('fade-out');

      // Показываем уведомление
      onNotification({
        message: `Установлена новая горячая клавиша: ${hotkeyLabel}`,
        type: 'success'
      });

      // Закрываем меню после завершения анимации
      setTimeout(() => {
        setShowHotkeyMenu(false);
        // Убираем класс анимации для следующего открытия
        menu.classList.remove('fade-out');
      }, 300); // Время должно совпадать с длительностью анимации в CSS
    }
  };

  useEffect(() => {
    if (isRecordingHotkey) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isRecordingHotkey]);

  // Обновленное меню горячих клавиш
  const HotkeyMenu = () => (
    <div className="hotkey-menu">
      <div className="hotkey-menu-header">
        <span>Настройка горячей клавиши</span>
        <button 
          className="close-menu"
          onClick={() => setShowHotkeyMenu(false)}
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
      <div className="hotkey-content">
        <div className="current-hotkey">
          <span>Текущая клавиша:</span>
          <span className="hotkey-display">{currentHotkey.label}</span>
        </div>
        <button 
          className={`record-hotkey-button ${isRecordingHotkey ? 'recording' : ''}`}
          onClick={() => setIsRecordingHotkey(true)}
        >
          {isRecordingHotkey ? 'Нажмите клавишу...' : 'Назначить новую клавишу'}
        </button>
      </div>
    </div>
  );

  // бновленная обработка горячих клавиш
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const hotkeyCode = getHotkeyCode(e);
      
      if (hotkeyCode === currentHotkey.key && !e.repeat && !isRecordingHotkey) {
        e.preventDefault();
        isKeyPressed.current = true;
        
        if (pressTimer.current) {
          clearTimeout(pressTimer.current);
        }
        
        pressTimer.current = setTimeout(() => {
          if (isKeyPressed.current) {
            startRecording();
          }
          pressTimer.current = null;
        }, minPressTime);
      }
    };

    const handleGlobalKeyUp = (e) => {
      const hotkeyCode = getHotkeyCode(e);
      
      if (hotkeyCode === currentHotkey.key) {
        e.preventDefault();
        isKeyPressed.current = false;
        
        if (pressTimer.current) {
          clearTimeout(pressTimer.current);
          pressTimer.current = null;
        }

        if (isRecording) {
          stopRecording();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, [currentHotkey, isRecording, isRecordingHotkey]);

  // Обработка клика по кнопке
  const handleClick = () => {
    if (!isRecording) {
      isKeyPressed.current = true; // Устанавливаем флаг при клике
      startRecording();
    } else {
      isKeyPressed.current = false; // Сбрасываем флаг
      stopRecording();
    }
  };

  return (
    <div className="microphone-container">
      <div className="controls-group">
        <button 
          className={`microphone-button ${isRecording ? 'active' : ''}`}
          onClick={handleClick}
          title={isRecording ? "Остановить запись" : "Начать запись"}
        >
          <i className="fas fa-microphone"></i>
        </button>
        
        <div className="playback-controls">
          <button 
            className={`play-last-recording ${currentFileName ? 'playing' : ''}`}
            onClick={playLastRecording}
            title={currentFileName ? "Остановить воспроизведение" : "Прослушать последнюю запись"}
            disabled={isProcessing}
          >
            <i className={`fas ${currentFileName ? 'fa-pause' : 'fa-play'}`}></i>
          </button>
          
          <label className="custom-checkbox">
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={(e) => setAutoPlay(e.target.checked)}
            />
            <span className="checkbox-icon">
              <i className="fas fa-check"></i>
            </span>
            Прослушивать после записи
          </label>
        </div>

        <div className="hint-container">
          <span className="hint-text">
            Удерживайте {currentHotkey.label} для записи
          </span>
          <button 
            className="settings-button"
            onClick={() => setShowHotkeyMenu(!showHotkeyMenu)}
            title="Настроить горячую клавишу"
          >
            <i className="fas fa-keyboard"></i>
          </button>
          {showHotkeyMenu && (
            <div id="hotkeyMenu" className="hotkey-menu">
              <div className="hotkey-menu-header">
                <span>Настройка горячей клавиши</span>
                <button 
                  className="close-menu"
                  onClick={() => setShowHotkeyMenu(false)}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="hotkey-content">
                <div className="current-hotkey">
                  <span>Текущая клавиша:</span>
                  <span className="hotkey-display">{currentHotkey.label}</span>
                </div>
                <button 
                  className={`record-hotkey-button ${isRecordingHotkey ? 'recording' : ''}`}
                  onClick={() => setIsRecordingHotkey(true)}
                >
                  {isRecordingHotkey ? 'Нажмите клавишу...' : 'Назначить новую клавишу'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MicrophoneButton;