import React, { useState } from 'react';
import '../styles/LoadingScreen.css';

const LoadingScreen = ({ currentStage, stages, onContinue, isReady, modelDetails, showMemoryUsage, onBack }) => {
  const [expandedStage, setExpandedStage] = useState(null);

  const getStageStatus = (stageId) => {
    if (currentStage === 'completed') return 'completed';
    const currentIndex = stages.findIndex(s => s.id === currentStage);
    const stageIndex = stages.findIndex(s => s.id === stageId);
    if (stageIndex < currentIndex) return 'completed';
    if (stageIndex === currentIndex) return 'current';
    return 'pending';
  };

  const handleStageClick = (stageId) => {
    if (stageId === 'models' || stageId === 'final') {
      setExpandedStage(expandedStage === stageId ? null : stageId);
    }
  };

  const allStagesCompleted = stages.every(stage => getStageStatus(stage.id) === 'completed');

  const renderMemoryUsageStatus = () => {
    const isFinalStage = currentStage === 'final' || currentStage === 'completed';
    
    if (!isFinalStage) {
      return <i className="fas fa-spinner fa-spin"></i>;
    }
    
    if (showMemoryUsage) {
      return <i className="fas fa-check text-success"></i>;
    } else {
      return <i className="fas fa-times text-error"></i>;
    }
  };

  return (
    <div className="loading-screen">
      <button className="back-button" onClick={onBack}>
        <i className="fas fa-arrow-left"></i>
        Вернуться к настройкам
      </button>
      <div className="loading-content">
        <h2>Инициализация Voice3Frame</h2>
        <div className="loading-stages">
          {stages.map(stage => (
            <div 
              key={stage.id} 
              className={`loading-stage ${getStageStatus(stage.id)} ${stage.id === expandedStage ? 'expanded' : ''}`}
              onClick={() => handleStageClick(stage.id)}
            >
              <div className="stage-icon">
                {getStageStatus(stage.id) === 'completed' ? (
                  <i className="fas fa-check"></i>
                ) : getStageStatus(stage.id) === 'current' ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-circle"></i>
                )}
              </div>
              <div className="stage-info">
                <div className="stage-header">
                  <div className="stage-name">
                    {stage.name}
                    {(stage.id === 'models' || stage.id === 'final') && (
                      <i className={`fas fa-chevron-${expandedStage === stage.id ? 'up' : 'down'} expand-icon`}></i>
                    )}
                  </div>
                </div>
                <div className="stage-description">{stage.description}</div>
                
                {stage.id === 'models' && expandedStage === 'models' && modelDetails && (
                  <div className="model-details">
                    <div className="model-item">
                      <div className="model-header">
                        <div className="model-name">
                          <i className="fab fa-google"></i>
                          Google Speech Recognition
                        </div>
                        <div>
                          {modelDetails.google.status === 'ready' ? (
                            <i className="fas fa-check text-success"></i>
                          ) : (
                            <i className="fas fa-spinner fa-spin"></i>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="model-item">
                      <div className="model-header">
                        <div className="model-name">
                          <svg className="openai-icon" viewBox="0 0 24 24">
                            <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
                          </svg>
                          Whisper Model ({modelDetails.whisper.model})
                        </div>
                        <div>
                          {modelDetails.whisper.status === 'ready' ? (
                            <i className="fas fa-check text-success"></i>
                          ) : (
                            <i className="fas fa-spinner fa-spin"></i>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {stage.id === 'final' && expandedStage === 'final' && (
                  <div className="interface-details">
                    <div className="interface-item">
                      <div className="interface-header">
                        <div className="interface-name">
                          <i className="fas fa-microchip"></i>
                          Индикатор использования ОЗУ
                        </div>
                        <div>
                          {renderMemoryUsageStatus()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {allStagesCompleted && isReady && (
          <button className="continue-button" onClick={onContinue}>
            Начать работу
            <i className="fas fa-arrow-right"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen; 