import React, { useState, useEffect } from 'react';
import '../styles/SystemSettings.css';

const SystemSettings = ({ onConfirm, initialModel = 'tiny', initialShowMemory = true }) => {
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [showMemoryUsage, setShowMemoryUsage] = useState(initialShowMemory);
  const [activeTab, setActiveTab] = useState('models');
  const [modelStatuses, setModelStatuses] = useState({});
  const [modelsPath, setModelsPath] = useState('');
  const [modelSizes, setModelSizes] = useState({});

  useEffect(() => {
    const fetchModelsInfo = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/models-info');
        const data = await response.json();
        if (data.success) {
          setModelsPath(data.models_path);
          setModelSizes(data.model_sizes || {});
          setModelStatuses(data.installed_models || {});
        }
      } catch (error) {
        console.error('Ошибка при получении информации о моделях:', error);
      }
    };

    fetchModelsInfo();
  }, []);

  const handlePathChange = () => {
    alert('Функция выбора директории будет доступна в следующей версии');
  };

  const handleClearModels = async () => {
    if (window.confirm('Вы уверены, что хотите удалить все установленные модели?')) {
      try {
        const response = await fetch('http://localhost:5000/api/clear-models', {
          method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
          // Обновляем информацию о моделях
          setModelSizes({});
          setModelStatuses({});
        }
      } catch (error) {
        console.error('Ошибка при очистке моделей:', error);
      }
    }
  };

  const whisperModels = [
    {
      id: 'tiny',
      name: 'Tiny',
      description: 'Самая быстрая модель, базовое качество распознавания',
      specs: 'RAM: 1GB, Скорость: 32x'
    },
    {
      id: 'base',
      name: 'Base',
      description: 'Оптимальный баланс скорости и качества',
      specs: 'RAM: 1.5GB, Скорость: 16x'
    },
    {
      id: 'small',
      name: 'Small',
      description: 'Улучшенное качество распознавания',
      specs: 'RAM: 2GB, Скорость: 8x'
    },
    {
      id: 'medium',
      name: 'Medium',
      description: 'Высокое качество распознавания',
      specs: 'RAM: 5GB, Скорость: 4x'
    }
  ];

  return (
    <div className="system-settings">
      <div className="settings-content">
        <h2>Конфигурация системы</h2>
        
        <div className="settings-tabs">
          <button 
            className={`tab-button ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            <i className="fas fa-microphone"></i>
            Модели распознавания
          </button>
          <button 
            className={`tab-button ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <i className="fas fa-cog"></i>
            Системные настройки
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'models' && (
            <div className="settings-section">
              <div className="model-options">
                <h4>Faster Whisper</h4>
                <div className="model-grid">
                  {whisperModels.map(model => (
                    <div 
                      key={model.id}
                      className={`model-card ${selectedModel === model.id ? 'selected' : ''}`}
                      onClick={() => setSelectedModel(model.id)}
                    >
                      <div className="model-header">
                        <div className="model-title">
                          <span className="model-name">{model.name}</span>
                          {modelStatuses[model.id] ? (
                            <div className="model-status installed" title="Модель установлена локально">
                              <i className="fas fa-check-circle"></i>
                            </div>
                          ) : (
                            <div className="model-status not-installed" title="Модель не установлена">
                              <i className="fas fa-download"></i>
                            </div>
                          )}
                          {modelSizes[model.id] && (
                            <div className="model-size" title="Размер установленной модели">
                              <i className="fas fa-hdd"></i>
                              {modelSizes[model.id]}
                            </div>
                          )}
                        </div>
                        <div className="model-radio">
                          <div className="radio-circle">
                            {selectedModel === model.id && <div className="radio-dot"></div>}
                          </div>
                        </div>
                      </div>
                      <p className="model-description">{model.description}</p>
                      <div className="model-specs">
                        <i className="fas fa-microchip"></i>
                        <span>{model.specs}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="models-path-info">
                  <div className="path-header">
                    <div className="path-title">
                      <i className="fas fa-folder text-warning"></i>
                      <span>Путь к моделям</span>
                    </div>
                    <button className="path-change-button" onClick={handlePathChange}>
                      <i className="fas fa-folder-open"></i>
                      Обзор
                    </button>
                  </div>
                  <div className="path-value">{modelsPath}</div>
                </div>

                <button className="clear-models-button" onClick={handleClearModels}>
                  <i className="fas fa-trash-alt"></i>
                  Очистить все модели
                </button>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="settings-section">
              <div className="system-options">
                <label className="system-option">
                  <div className="option-info">
                    <span className="option-name">Отображение использования ОЗУ</span>
                    <span className="option-description">Показывать индикатор использования памяти</span>
                  </div>
                  <div className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={showMemoryUsage}
                      onChange={(e) => setShowMemoryUsage(e.target.checked)}
                    />
                    <div className="checkbox-custom"></div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <button 
          className="confirm-settings" 
          onClick={() => onConfirm({ 
            whisperModel: selectedModel,
            showMemoryUsage
          })}
        >
          Применить конфигурацию
        </button>
      </div>
    </div>
  );
};

export default SystemSettings;