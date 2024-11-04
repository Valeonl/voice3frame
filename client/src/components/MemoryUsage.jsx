import React, { useState, useEffect, useRef } from 'react';
import '../styles/MemoryUsage.css';

const MemoryUsage = ({ enabled }) => {
  const [memoryInfo, setMemoryInfo] = useState({
    used: 0,
    total: 0,
    free: 0,
    percent: 0,
    details: {
      nodejs: 0,
      python: 0
    }
  });
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('memoryUsagePosition');
    return saved ? JSON.parse(saved) : { right: '20px', bottom: '20px' };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return () => {}; // Если компонент отключен, не запускаем опрос

    const fetchMemoryInfo = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/memory-usage');
        const data = await response.json();
        
        if (data.success) {
          setMemoryInfo({
            used: data.used,
            total: data.total,
            free: data.free,
            percent: data.percent,
            details: data.details
          });
        }
      } catch (error) {
        console.error('Ошибка при получении информации о памяти:', error);
      }
    };

    const interval = setInterval(fetchMemoryInfo, 2000);
    fetchMemoryInfo();

    return () => clearInterval(interval);
  }, [enabled]);

  // Если компонент отключен, не рендерим его
  if (!enabled) return null;

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragRef.current = e.currentTarget;
    const rect = dragRef.current.getBoundingClientRect();
    dragStartPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    // Добавляем обработчики на document
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragRef.current) return;

    const newX = e.clientX - dragStartPos.current.x;
    const newY = e.clientY - dragStartPos.current.y;

    // Ограничиваем перемещение в пределах окна
    const maxX = window.innerWidth - dragRef.current.offsetWidth;
    const maxY = window.innerHeight - dragRef.current.offsetHeight;
    
    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));

    const newPosition = {
      right: `${window.innerWidth - boundedX - dragRef.current.offsetWidth}px`,
      bottom: `${window.innerHeight - boundedY - dragRef.current.offsetHeight}px`
    };

    setPosition(newPosition);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem('memoryUsagePosition', JSON.stringify(position));
      
      // Удаляем обработчики с document
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  };

  const formatMemory = (gb) => {
    if (gb < 0.01) return '< 0.01';
    return gb.toFixed(2);
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 50) return 'critical';    // Если занимаем больше 50% свободной памяти
    if (percentage >= 25) return 'warning';     // Если занимаем больше 25% свободной памяти
    return 'normal';
  };

  return (
    <div 
      ref={dragRef}
      className={`memory-usage ${isDragging ? 'dragging' : ''}`}
      style={{ 
        ...position,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="memory-info">
        <span className="memory-label">ОЗУ:</span>
        <span className="memory-value">
          {formatMemory(memoryInfo.used)}ГБ / {formatMemory(memoryInfo.free)}ГБ доступно
        </span>
      </div>
      <div className="memory-details">
        <span className="detail-item">Клиент: {formatMemory(memoryInfo.details.nodejs)}ГБ</span>
        <span className="detail-item">Сервер: {formatMemory(memoryInfo.details.python)}ГБ</span>
      </div>
      <div className={`memory-indicator ${getStatusColor(memoryInfo.percent)}`}>
        <div 
          className="memory-level" 
          style={{ width: `${memoryInfo.percent}%` }}
        >
          {[...Array(5)].map((_, i) => (
            <div key={i} className="memory-segment"></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MemoryUsage;