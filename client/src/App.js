import React, { useState, useEffect } from 'react';
import MicrophoneButton from './components/MicrophoneButton';
import TranscriptionDisplay from './components/TranscriptionDisplay';
import RecordingsHistory from './components/RecordingsHistory';
import Notification from './components/Notification';
import LoadingScreen from './components/LoadingScreen';
import SystemSettings from './components/SystemSettings';
import ModelSelector from './components/ModelSelector';
import InitialLoader from './components/InitialLoader';
import logo from './image/logo.png';
import './App.css';
import MemoryUsage from './components/MemoryUsage';

function App() {
  const [transcribedText, setTranscribedText] = useState('');
  const [notification, setNotification] = useState(null);
  const [currentStage, setCurrentStage] = useState('init');
  const [isReady, setIsReady] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [recognitionModel, setRecognitionModel] = useState('google');
  const [modelDetails, setModelDetails] = useState(null);
  const [systemInitialized, setSystemInitialized] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pageReady, setPageReady] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [transitionClass, setTransitionClass] = useState('');
  const [currentScreen, setCurrentScreen] = useState('loader');
  const [currentWhisperModel, setCurrentWhisperModel] = useState('tiny');
  const [serverError, setServerError] = useState(false);
  const [showMemoryUsage, setShowMemoryUsage] = useState(true);

  const stages = [
    {
      id: 'init',
      name: 'Инициализация приложения',
      description: 'Загрузка основных компонентов'
    },
    {
      id: 'models',
      name: 'Загрузка моделей',
      description: 'Инициализация моделей распознавания речи'
    },
    {
      id: 'final',
      name: 'Завершение настройки',
      description: 'Подготовка интерфейса'
    }
  ];

  useEffect(() => {
    const checkSystem = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/system-status');
        const data = await response.json();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (data.initialized) {
          setSystemInitialized(true);
          setShowSettings(false);
          setShowApp(true);
          handleScreenTransition('app');
        } else {
          handleScreenTransition('settings');
        }
        
        setLoaderVisible(false);
        
      } catch (error) {
        setNotification({
          message: 'Ошибка подключения к серверу',
          type: 'error'
        });
        setLoaderVisible(false);
      }
    };

    checkSystem();
  }, []);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/health-check');
        if (!response.ok) {
          throw new Error('Сервер недоступен');
        }
        setServerError(false);
      } catch (error) {
        setServerError(true);
        setLoaderVisible(false);
        setPageReady(true);
      }
    };

    checkServer();
  }, []);

  const handleScreenTransition = (nextScreen) => {
    setTransitionClass('fade-out');
    setTimeout(() => {
      setCurrentScreen(nextScreen);
      setTransitionClass('fade-in');
    }, 500);
  };

  const preloadResources = async () => {
    try {
      setCurrentStage('final');
      
      // Список всех ресурсов для предзагрузки
      const resources = [
        { type: 'image', src: logo },
        { type: 'font', src: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-solid-900.woff2' },
        { type: 'font', src: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-brands-400.woff2' }
      ];

      // Загружаем все ресурсы параллельно
      const loadPromises = resources.map(resource => {
        if (resource.type === 'image') {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(`Загружено изображение: ${resource.src}`);
            img.onerror = () => reject(`Ошибка загрузки изображения: ${resource.src}`);
            img.src = resource.src;
          });
        } else if (resource.type === 'font') {
          return fetch(resource.src)
            .then(response => response.blob())
            .then(() => `Загружен шрифт: ${resource.src}`);
        }
      });

      // Ждем загрузки всех ресурсов
      const results = await Promise.allSettled(loadPromises);
      
      // Проверяем результаты загрузки
      const failedLoads = results.filter(result => result.status === 'rejected');
      if (failedLoads.length > 0) {
        console.warn('Некоторые ресурсы не загрузились:', failedLoads);
      }

      // Даем небольшую задержку для анимации
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Завершаем инициализацию
      setCurrentStage('completed');
      setIsReady(true);

    } catch (error) {
      console.error('Ошибка при предзагрузке ресурсов:', error);
      // Даже если что-то не загрузилось, все равно завершаем инициализацию
      setCurrentStage('completed');
      setIsReady(true);
    }
  };

  const handleSettingsConfirm = async (settings) => {
    handleScreenTransition('loading');
    setCurrentStage('init');
    setCurrentWhisperModel(settings.whisperModel);
    setShowMemoryUsage(settings.showMemoryUsage);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setCurrentStage('models');

      setModelDetails({
        google: { status: 'loading', message: 'Инициализация...' },
        whisper: { 
          status: 'loading', 
          model: settings.whisperModel,
          message: 'Загрузка дели...',
          progress: 0
        }
      });

      const response = await fetch('http://localhost:5000/api/initialize-models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) throw new Error('Ошибка инициализации моделей');

      const data = await response.json();
      
      setModelDetails({
        google: { status: 'ready', message: 'Готово к работе' },
        whisper: { 
          status: 'ready', 
          model: settings.whisperModel,
          message: 'Модель загружена',
          progress: 100
        }
      });

      await preloadResources();

    } catch (error) {
      setNotification({
        message: 'Ошибка при инициализации системы',
        type: 'error'
      });
      console.error('Ошибка:', error);
    }
  };

  const handleContinue = () => {
    handleScreenTransition('app');
  };

  const handleReset = () => {
    handleScreenTransition('settings');
    setIsReady(false);
    setCurrentStage('init');
    setModelDetails(null);
  };

  const handleBack = async () => {
    try {
      // Отправляем запрос на отмену инициализации
      await fetch('http://localhost:5000/api/cancel-initialization', {
        method: 'POST'
      });
      
      // Сбрасываем состояния
      setCurrentStage('init');
      setIsReady(false);
      setModelDetails(null);
      
      // Возвращаемся к настройкам
      handleScreenTransition('settings');
      
      // Очищаем localStorage, чтобы при следующей загрузке начать с настроек
      localStorage.removeItem('systemInitialized');
      
    } catch (error) {
      console.error('Ошибка при отмене инициализации:', error);
    }
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'loader':
        return <InitialLoader className={loaderVisible ? '' : 'fade-out'} />;
      
      case 'settings':
        return <SystemSettings 
          onConfirm={handleSettingsConfirm} 
          initialModel={currentWhisperModel}
          initialShowMemory={showMemoryUsage}
        />;
      
      case 'loading':
        return (
          <LoadingScreen
            currentStage={currentStage}
            stages={stages}
            onContinue={handleContinue}
            isReady={isReady}
            modelDetails={modelDetails}
            showMemoryUsage={showMemoryUsage}
            onBack={handleBack}
          />
        );
      
      case 'app':
        return (
          <>
            <div className="App">
              <button className="reset-system" onClick={handleReset}>
                <i className="fas fa-cog"></i>
                Изменить конфигурацию системы
              </button>

              <ModelSelector
                currentModel={recognitionModel}
                onModelChange={setRecognitionModel}
                whisperModel={currentWhisperModel}
              />
              
              <div className="app-header">
                <div className="header-content">
                  <div className="title-container">
                    <h1 className="app-title">Voice3Frame</h1>
                    <p className="app-subtitle">Голосовой помощник в области видеомонтажа</p>
                  </div>
                  <img src={logo} alt="Voice3Frame Logo" className="app-logo" />
                </div>
              </div>

              {notification && (
                <Notification
                  message={notification.message}
                  type={notification.type}
                  onClose={() => setNotification(null)}
                />
              )}

              <div className="content-container">
                <MicrophoneButton 
                  onTranscriptionReceived={setTranscribedText}
                  onNotification={setNotification}
                  recognitionModel={recognitionModel}
                />
                <TranscriptionDisplay text={transcribedText} />
              </div>

              <RecordingsHistory onClearAll={() => setTranscribedText('')} />
            </div>
            {showMemoryUsage && <MemoryUsage enabled={showMemoryUsage} />}
          </>
        );
      
      default:
        return null;
    }
  };

  if (serverError) {
    return (
      <div className="server-error">
        <i className="fas fa-exclamation-triangle"></i>
        <h2>Сервер недоступен</h2>
        <p>Пожалуйста, убедитесь, что сервер запущен и попробуйте перезагрузить страницу</p>
        <button onClick={() => window.location.reload()}>
          Перезагрузить страницу
        </button>
      </div>
    );
  }

  return (
    <div className={`screen-container ${transitionClass}`}>
      {renderCurrentScreen()}
    </div>
  );
}

export default App; 