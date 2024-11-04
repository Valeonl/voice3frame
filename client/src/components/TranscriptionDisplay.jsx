import React from 'react';
import '../styles/TranscriptionDisplay.css';

const TranscriptionDisplay = ({ text }) => {
  return (
    <div className="transcription-container">
      {text ? (
        <p className="transcription-text">{text}</p>
      ) : (
        <p className="placeholder-text">Здесь появится текст после записи...</p>
      )}
    </div>
  );
};

export default TranscriptionDisplay; 