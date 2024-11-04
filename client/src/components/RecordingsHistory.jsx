import React, { useState, useEffect, useRef } from 'react';
import '../styles/RecordingsHistory.css';
import useRecordingsStore from '../store/RecordingsStore';
import useAudioPlayerStore from '../store/AudioPlayerStore';

const RecordingsHistory = ({ onClearAll }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRecordings, setSelectedRecordings] = useState(new Set());
  const currentAudio = useRef(null);
  const [playingRecording, setPlayingRecording] = useState(null);

  const { 
    recordings, 
    totalRecordings, 
    removeRecording, 
    clearRecordings,
    syncWithServer,
    isLoading,
    getState
  } = useRecordingsStore();

  const { playAudio, stopAudio, isPlayingFile } = useAudioPlayerStore();

  // Добавим состояние для отслеживания анимации загрузки
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeout = useRef(null);
  const lastUpdateTime = useRef(Date.now());
  const updateDelay = 5000; // 5 секунд между анимациями

  // Обновленная логика синхронизации и анимации
  useEffect(() => {
    const handleSync = async () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime.current;

      // Проверяем, нужно ли показывать анимацию
      if (timeSinceLastUpdate >= updateDelay) {
        setIsAnimating(true);
        lastUpdateTime.current = now;

        // Запускаем синхронизацию
        await syncWithServer();

        // Оставляем анимацию на 2 секунды после синхронизации
        if (animationTimeout.current) {
          clearTimeout(animationTimeout.current);
        }
        animationTimeout.current = setTimeout(() => {
          setIsAnimating(false);
        }, 2000);
      } else {
        // Если прошло мало времени, просто синхронизируем без анимации
        await syncWithServer();
      }
    };

    // Начальная синхронизация
    handleSync();

    // Периодическая синхронизация
    const interval = setInterval(handleSync, 3000);

    return () => {
      clearInterval(interval);
      if (animationTimeout.current) {
        clearTimeout(animationTimeout.current);
      }
    };
  }, [syncWithServer]);

  useEffect(() => {
    setSelectedRecordings(new Set());
  }, [recordings.length]);

  // Обновляем логику обработки записей
  const processRecordings = (recordings) => {
    const currentState = getState();
    return recordings.map(recording => {
      const existingRec = currentState.recordings.find(r => r.filename === recording.filename);
      return existingRec ? { ...recording, processing: existingRec.processing } : recording;
    });
  };

  const handleDelete = async (filename) => {
    const isLastRecording = recordings.length === 1;
    removeRecording(filename);

    try {
      await fetch(`http://localhost:5000/api/recordings/${filename}`, {
        method: 'DELETE'
      });
      if (isLastRecording) {
        onClearAll(); // Очищаем текстовое поле при удалении последней записи
      }
    } catch (error) {
      console.error('Ошибка при удалении:', error);
      await syncWithServer();
    }
  };

  const handleClearAll = async () => {
    clearRecordings();
    onClearAll();
    setSelectedRecordings(new Set());
    setIsOpen(false); // Добавляем скрытие панели

    try {
      await fetch('http://localhost:5000/api/recordings/clear', {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Ошибка при очистке:', error);
      await syncWithServer();
    }
  };

  const handleDeleteSelected = async () => {
    const selectedFiles = Array.from(selectedRecordings);
    setSelectedRecordings(new Set());

    // Оптимистично удаляем записи
    selectedFiles.forEach(filename => {
      removeRecording(filename);
    });

    try {
      await Promise.all(selectedFiles.map(filename => 
        fetch(`http://localhost:5000/api/recordings/${filename}`, {
          method: 'DELETE'
        })
      ));
      
      await syncWithServer();
    } catch (error) {
      console.error('Ошибка при удалении файлов:', error);
      await syncWithServer();
    }
  };

  const toggleSelection = (filename) => {
    const newSelection = new Set(selectedRecordings);
    if (newSelection.has(filename)) {
      newSelection.delete(filename);
    } else {
      newSelection.add(filename);
    }
    setSelectedRecordings(newSelection);
  };

  const clearSelection = () => {
    setSelectedRecordings(new Set());
  };

  const handlePlayRecording = async (recording) => {
    if (recording.processing) return;

    try {
      // Если этот файл уже играет - останавливаем его
      if (isPlayingFile(recording.filename)) {
        stopAudio();
        return;
      }

      // Создаем новый аудио элемент
      const audio = new Audio(`http://localhost:5000/api/recordings/play/${recording.filename}`);
      
      audio.onerror = (e) => {
        console.error('Ошибка воспроизведения:', e);
        stopAudio();
      };

      // Сразу запускаем воспроизведение
      playAudio(audio, recording.filename);

    } catch (error) {
      console.error('Ошибка при инициализации воспроизведения:', error);
      stopAudio();
    }
  };

  // Очистка при размонтировании компонента
  useEffect(() => {
    return () => {
      if (currentAudio.current) {
        currentAudio.current.pause();
        currentAudio.current = null;
      }
      setPlayingRecording(null);
    };
  }, []);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    
    // Форматируем дату в формат ДД.ММ.ГГГГ
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    // Форматируем время в формат ЧЧ:ММ
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}.${month}.${year} время: ${hours}:${minutes}`;
  };

  const formatDuration = (duration) => {
    if (!duration) return '';
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `длительность: ${minutes} мин. ${seconds} сек.`;
  };

  return (
    <div className={`recordings-panel ${isOpen ? 'open' : ''}`}>
      <button 
        className="toggle-panel-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <i className={`fas fa-chevron-${isOpen ? 'down' : 'up'}`}></i>
      </button>
      
      {isOpen && (
        <div className="recordings-content">
          <div className="recordings-header">
            <div className="recordings-count">
              Всего записей: {totalRecordings}
              {isAnimating && (
                <div className="loading-indicator">
                  <i className="fas fa-sync"></i>
                </div>
              )}
            </div>
            {totalRecordings > 0 && selectedRecordings.size > 0 && (
              <div className="header-controls">
                <button 
                  className="clear-selection-button"
                  onClick={clearSelection}
                >
                  <i className="fas fa-times"></i> Снять выделение
                </button>
                <button 
                  className="clear-all-button"
                  onClick={handleDeleteSelected}
                  title="Удалить выбранные"
                >
                  <i className="fas fa-trash-alt"></i> Удалить выбранные
                </button>
              </div>
            )}
            {totalRecordings > 0 && selectedRecordings.size === 0 && (
              <div className="header-controls">
                <button 
                  className="clear-all-button"
                  onClick={handleClearAll}
                  title="Удалить все записи"
                >
                  <i className="fas fa-trash-alt"></i> Очистить все
                </button>
              </div>
            )}
          </div>
          
          <div className="recordings-list custom-scrollbar">
            {recordings.map((recording, index) => (
              <div key={recording.filename} 
                   className={`recording-item ${recording.processing ? 'processing' : ''}`}>
                <label className="recording-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedRecordings.has(recording.filename)}
                    onChange={() => toggleSelection(recording.filename)}
                    disabled={recording.processing || !recording.duration}
                  />
                  <span className="checkbox-custom"></span>
                </label>
                <span className="recording-number">{recordings.length - index}</span>
                <div className="recording-info">
                  <div className="recording-name">
                    {recording.processing ? 
                      'Обработка записи...' : 
                      (recording.transcription || 'Текст не распознан')}
                  </div>
                  <div className="recording-time">
                    {formatDate(recording.timestamp)}
                    {recording.duration && 
                      <span className="recording-duration">
                        ({formatDuration(recording.duration)})
                      </span>
                    }
                  </div>
                </div>
                <div className="recording-controls">
                  {recording.processing || !recording.duration ? (
                    <div className="processing-indicator">
                      <i className="fas fa-hourglass"></i>
                    </div>
                  ) : (
                    <>
                      <button 
                        className={`play-button ${isPlayingFile(recording.filename) ? 'playing' : ''}`}
                        onClick={() => handlePlayRecording(recording)}
                      >
                        <i className={`fas ${isPlayingFile(recording.filename) ? 'fa-pause' : 'fa-play'}`}></i>
                      </button>
                      <button 
                        className="delete-button"
                        onClick={() => handleDelete(recording.filename)}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordingsHistory; 