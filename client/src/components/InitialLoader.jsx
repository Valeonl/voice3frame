import React from 'react';
import '../styles/InitialLoader.css';

const InitialLoader = ({ className }) => {
  return (
    <div className={`initial-loader ${className || ''}`}>
      <div className="loader-content">
        <div className="spinner">
          <i className="fas fa-circle-notch fa-spin"></i>
        </div>
        <div className="loader-text">
          Загрузка<span className="dot-1">.</span><span className="dot-2">.</span><span className="dot-3">.</span>
        </div>
      </div>
    </div>
  );
};

export default InitialLoader; 