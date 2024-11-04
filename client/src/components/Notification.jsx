import React, { useEffect } from 'react';
import '../styles/Notification.css';

const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`notification ${type}`}>
      <span className="notification-message">{message}</span>
      <button className="notification-close" onClick={onClose}>
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

export default Notification; 