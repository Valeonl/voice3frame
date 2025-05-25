import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  TextField,
  Button,
  Select,
  MenuItem,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Paper,
  CircularProgress,
  Snackbar,
  Tooltip,
  Fab,
} from '@mui/material';
import {
  Send as SendIcon,
  History as HistoryIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  Close as CloseIcon,
  Mic as MicIcon,
  Stop as StopIcon,
  Keyboard as KeyboardIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CommandEditor from './components/CommandEditor';
import { PromptConfig } from './types/commands';
import { SelectChangeEvent } from '@mui/material/Select';

// Конфигурация axios
const api = axios.create({
  baseURL: 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 60000
});

// Создаем функцию для повторных попыток
const retryRequest = async (fn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying... ${retries} attempts left`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

// Функция для проверки и форматирования JSON
const formatJsonResponse = (text: string): { isJson: boolean; formatted: string } => {
  // Попытка найти JSON в тексте с помощью регулярного выражения
  const jsonRegex = /```json\s*([\s\S]*?)\s*```|(\[[\s\S]*\]|\{[\s\S]*\})/;
  const match = text.match(jsonRegex);
  
  if (match) {
    const jsonStr = match[1] || match[2]; // Берем либо содержимое внутри ```json ``` либо прямой JSON
    try {
      const parsed = JSON.parse(jsonStr.trim());
      return {
        isJson: true,
        formatted: JSON.stringify(parsed, null, 2)
      };
    } catch (e) {
      console.error('Failed to parse JSON:', e);
    }
  }
  
  // Если не удалось найти и распарсить JSON, возвращаем исходный текст
  return {
    isJson: false,
    formatted: text
  };
};

const theme = createTheme({
  palette: {
    primary: {
      main: '#4a90e2',
    },
    background: {
      default: '#f5f7fa',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 20,
          padding: '8px 16px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: 10,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(74, 144, 226, 0.1)',
            transform: 'scale(1.05)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& fieldset': {
              transition: 'border-color 0.2s ease',
            },
            '&:hover fieldset': {
              borderColor: '#4a90e2',
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

// Типы режимов голосового ввода
type VoiceInputMode = 'standard' | 'realtime';

interface VoiceModeOption {
  value: VoiceInputMode;
  label: string;
  description: string;
}

const VOICE_MODES: VoiceModeOption[] = [
  {
    value: 'standard',
    label: 'Стандартный',
    description: 'Запись до остановки, результат после завершения'
  },
  {
    value: 'realtime',
    label: 'Расширенный',
    description: 'Автоматическое распознавание с паузами'
  }
];

// Интерфейс для состояния уведомления
interface SnackbarState {
  open: boolean;
  message: string;
  anchorOrigin: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}

function App() {
  const [userInput, setUserInput] = useState('');
  const [model, setModel] = useState('gemini-1.5-flash');
  const [loading, setLoading] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [snackbar, setSnackbar] = useState<SnackbarState>({ 
    open: false, 
    message: '',
    anchorOrigin: { vertical: 'top', horizontal: 'center' }
  });
  const [basePrompt, setBasePrompt] = useState('');
  const [activeStep, setActiveStep] = useState(-1);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [canStartRecording, setCanStartRecording] = useState(true);
  const [currentSpeech, setCurrentSpeech] = useState('');
  const [silenceTimeout, setSilenceTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastRecognizedText, setLastRecognizedText] = useState('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [audioDevice, setAudioDevice] = useState<string>('');
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isAudioInitialized = useRef<boolean>(false);
  const lastUpdateTime = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef<boolean>(false);
  const UPDATE_INTERVAL = 100; // минимальный интервал между обновлениями в мс
  
  const COOLDOWN_TIME = 1000; // время "остывания" в мс
  const SILENCE_TIMEOUT = 1000; // время паузы для отправки текста
  const [isHoldMode, setIsHoldMode] = useState(false);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isKeyDownRef = useRef(false);
  const HOLD_THRESHOLD = 250;
  const [isCommandEditorOpen, setIsCommandEditorOpen] = useState(false);
  const [commandConfig, setCommandConfig] = useState<PromptConfig | undefined>(undefined);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [hotkey, setHotkey] = useState<string>(localStorage.getItem('voiceHotkey') || 'Space');
  const [isHotkeyDialogOpen, setIsHotkeyDialogOpen] = useState(false);
  const [tempHotkey, setTempHotkey] = useState<string>('');
  const [isListeningForHotkey, setIsListeningForHotkey] = useState(false);

  // Функция для логирования
  const logEvent = (event: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] ${event}`, data ? data : '');
  };

  // Загружаем базовый промпт при монтировании компонента
  useEffect(() => {
    const fetchBasePrompt = async () => {
      try {
        const response = await api.get('/api/prompt');
        if (!response.data.error) {
          setBasePrompt(response.data.prompt);
        }
      } catch (error) {
        console.error('Error fetching base prompt:', error);
      }
    };
    fetchBasePrompt();
  }, []);

  // Загружаем конфигурацию при старте
  useEffect(() => {
    const loadConfig = async () => {
      try {
        console.log('Загружаем конфигурацию с сервера...');
        const response = await api.get('/api/prompt');
        
        if (response.data.error) {
          console.error('Ошибка от сервера:', response.data.error);
          // Если ошибка - загружаем дефолтную конфигурацию
          const { defaultConfig } = await import('./config/defaultCommands');
          setCommandConfig(defaultConfig);
          console.log('Загружена дефолтная конфигурация из-за ошибки сервера');
        } else {
          // Проверяем, есть ли конфигурация в ответе
          if (response.data.config) {
            setCommandConfig(response.data.config);
            console.log('Загружена конфигурация с сервера:', response.data.config);
            
            // Также устанавливаем базовый промпт из конфигурации
            if (response.data.prompt) {
              setBasePrompt(response.data.prompt);
              setPrompt(response.data.prompt); // Устанавливаем также текущий промпт
              console.log('Загружен промпт из конфигурации');
            }
          } else {
            console.log('Конфигурация не найдена в ответе, загружаем дефолтную');
            // Загружаем дефолтную конфигурацию
            const { defaultConfig } = await import('./config/defaultCommands');
            
            // Если есть промпт в ответе, добавляем его в конфигурацию
            if (response.data.prompt) {
              const configWithPrompt = {
                ...defaultConfig,
                promptText: response.data.prompt
              };
              setCommandConfig(configWithPrompt);
              setBasePrompt(response.data.prompt);
              setPrompt(response.data.prompt);
              console.log('Загружена дефолтная конфигурация с промптом из сервера');
            } else {
              setCommandConfig(defaultConfig);
              console.log('Загружена дефолтная конфигурация');
            }
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке конфигурации:', error);
        // В случае ошибки загружаем дефолтную конфигурацию
        const { defaultConfig } = await import('./config/defaultCommands');
        setCommandConfig(defaultConfig);
        console.log('Загружена дефолтная конфигурация из-за ошибки');
      }
    };

    loadConfig();
  }, []);

  // Загрузка горячей клавиши при монтировании
  useEffect(() => {
    const savedHotkey = localStorage.getItem('voiceHotkey');
    if (savedHotkey) {
      setHotkey(savedHotkey);
    }
  }, []);

  // Интерфейс для пропсов AudioMeter
  interface AudioMeterProps {
    audioLevel: number;
    audioDevice: string;
  }

  // Компонент мини-эквалайзера
  const AudioMeter = React.memo<AudioMeterProps>(({ audioLevel, audioDevice }) => (
    <Box
      sx={{
        position: 'absolute',
        left: 16,
        bottom: 32,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: '8px 16px',
        borderRadius: 2,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        maxWidth: '70%',
        overflow: 'hidden'
      }}
    >
      <Typography 
        variant="caption" 
        sx={{ 
          color: 'text.secondary',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '250px',
          fontSize: '1rem',
          marginRight: 2
        }}
      >
        {audioDevice}
      </Typography>
      <Box sx={{ 
        display: 'flex', 
        gap: 1,
        height: 40,
        alignItems: 'flex-end',
        minWidth: '200px'
      }}>
        {[...Array(8)].map((_, i) => (
          <Box
            key={i}
            sx={{
              width: 8,
              height: `${Math.min(100, (audioLevel / 255) * 100 * ((i + 1) / 8))}%`,
              backgroundColor: audioLevel > (255 * 0.8) ? 'error.main' :
                             audioLevel > (255 * 0.5) ? 'warning.main' : 
                             'success.main',
              transition: 'height 0.1s ease',
              borderRadius: '4px'
            }}
          />
        ))}
      </Box>
    </Box>
  ));

  // Обработчик нажатий клавиш
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const activeElement = document.activeElement?.tagName;
      // Проверяем, не открыт ли редактор команд
      const isEditorOpen = isCommandEditorOpen || promptOpen;
      
      // Игнорируем обработку если открыт редактор или фокус в поле ввода
      if (activeElement === 'TEXTAREA' || activeElement === 'INPUT' || isEditorOpen) {
        return;
      }

      // Режим прослушивания для новой горячей клавиши
      if (isListeningForHotkey) {
        e.preventDefault();
        const keyName = e.code;
        setTempHotkey(keyName);
        setIsListeningForHotkey(false);
        return;
      }

      // Обработка горячей клавиши
      if (e.code === hotkey && !e.repeat && canStartRecording) {
        e.preventDefault();
        if (!isKeyDownRef.current) {
          isKeyDownRef.current = true;
          holdTimeoutRef.current = setTimeout(() => {
            setIsHoldMode(true);
            handleVoiceRecord();
          }, HOLD_THRESHOLD);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === hotkey) {
        e.preventDefault();
        isKeyDownRef.current = false;
        
        // Очищаем таймер удержания
        if (holdTimeoutRef.current) {
          clearTimeout(holdTimeoutRef.current);
          holdTimeoutRef.current = null;
        }
        
        if (isHoldMode && isRecording) {
          // Если был режим удержания, останавливаем запись
          setIsHoldMode(false);
          stopRecording();
        } else if (!isHoldMode && !isRecording) {
          // Если не было удержания - это короткое нажатие
          handleVoiceRecord();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyUp);
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
    };
  }, [hotkey, isRecording, canStartRecording, isListeningForHotkey, isHoldMode, isCommandEditorOpen, promptOpen]);

  // Обновляем инициализацию распознавания речи
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ru-RU';

      recognition.onstart = () => {
        setIsRecording(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (isHoldMode) {
          // В режиме удержания только накапливаем текст
          setInterimTranscript(prev => prev + interim);
          if (final) {
            setInterimTranscript(prev => prev + final);
          }
        } else {
          // В обычном режиме обновляем промежуточный текст
          setInterimTranscript(interim);
          if (final) {
            setUserInput(prev => {
              const space = prev && !prev.endsWith(' ') ? ' ' : '';
              return prev + space + final;
            });
          }
        }
      };

      recognition.onend = () => {
        if (isHoldMode) {
          // В режиме удержания добавляем весь накопленный текст
          setUserInput(prev => {
            const space = prev && !prev.endsWith(' ') ? ' ' : '';
            return prev + space + interimTranscript;
          });
        } else {
          // В обычном режиме добавляем только последний промежуточный текст
          setUserInput(prev => {
            if (interimTranscript) {
              const space = prev && !prev.endsWith(' ') ? ' ' : '';
              return prev + space + interimTranscript;
            }
            return prev;
          });
        }
        setIsRecording(false);
        setInterimTranscript('');
        setIsHoldMode(false);
      };

      recognitionRef.current = recognition;
    }
  }, [isHoldMode]);

  // Функция для полной остановки записи
  const stopRecording = React.useCallback(() => {
    if (!isRecording) return;
    
    // Сбрасываем режим удержания при остановке
    setIsHoldMode(false);
    
    if (recognitionRef.current) {
      logEvent('Остановка записи', {
        текущийТекст: currentSpeech,
        последнийРаспознанныйТекст: lastRecognizedText,
        режим: isHoldMode ? 'удержание' : 'клик'
      });
      
      recognitionRef.current.stop();
      isRecognitionActiveRef.current = false;
      setIsRecording(false);
      setCanStartRecording(false);
      setCurrentSpeech('');
      setLastRecognizedText('');
      
      if (silenceTimeout) {
        clearTimeout(silenceTimeout);
        setSilenceTimeout(null);
      }
      
      setTimeout(() => setCanStartRecording(true), COOLDOWN_TIME);
    }
  }, [silenceTimeout, currentSpeech, lastRecognizedText, isRecording, isHoldMode]);

  // Функция для отправки результата
  const submitResult = React.useCallback((text: string) => {
    setSnackbar({
      open: true,
      message: `Распознано: "${text}"`,
      anchorOrigin: { vertical: 'top', horizontal: 'center' }
    });
    setUserInput(text);
    setCurrentSpeech('');
    setLastRecognizedText('');
  }, []);

  // Обработчик ошибок
  const handleError = (message: string) => {
    setSnackbar({
      open: true,
      message,
      anchorOrigin: { vertical: 'top', horizontal: 'center' }
    });
  };

  // Обновление уровня звука
  const updateAudioLevel = React.useCallback(() => {
    if (!analyserRef.current) return;
    
    const now = Date.now();
    if (now - lastUpdateTime.current >= UPDATE_INTERVAL) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average);
      lastUpdateTime.current = now;
    }
    
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  // Инициализация аудио анализатора
  const initAudioAnalyser = React.useCallback(async () => {
    if (isAudioInitialized.current) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        const track = streamRef.current.getAudioTracks()[0];
        setAudioDevice(track.label || 'Микрофон');
      }
      
      if (!analyserRef.current && audioContextRef.current && streamRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 32;
        source.connect(analyser);
        analyserRef.current = analyser;
        isAudioInitialized.current = true;
      }
    } catch (err) {
      console.error('Ошибка доступа к микрофону:', err);
      setAudioDevice('Микрофон недоступен');
    }
  }, []);

  // Функция для начала записи
  const startRecording = React.useCallback(() => {
    if (recognitionRef.current && canStartRecording && !isRecognitionActiveRef.current) {
      recognitionRef.current.start();
      isRecognitionActiveRef.current = true;
      setIsRecording(true);
    }
  }, [canStartRecording, isRecording]);

  // Обработчик кнопки записи
  const handleVoiceRecord = React.useCallback(() => {
    if (!recognitionRef.current) {
      logEvent('Ошибка: распознавание речи не поддерживается');
      handleError('Ваш браузер не поддерживает распознавание речи');
      return;
    }

    if (!isRecording && !canStartRecording) {
      logEvent('Ожидание: нужно подождать перед новой записью');
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, canStartRecording, stopRecording, startRecording]);

  useEffect(() => {
    let isComponentMounted = true;

    initAudioAnalyser().then(() => {
      if (isComponentMounted && analyserRef.current && !animationFrameRef.current) {
        updateAudioLevel();
      }
    });

    return () => {
      isComponentMounted = false;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
        audioContextRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      isAudioInitialized.current = false;
      lastUpdateTime.current = 0;
    };
  }, [initAudioAnalyser, updateAudioLevel]);

  useEffect(() => {
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'ru-RU';

      recognition.onresult = (event: any) => {
        logEvent('Получен результат распознавания', {
          количествоРезультатов: event.results.length
        });

        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            logEvent('Получен финальный результат', {
              текст: transcript
            });
            
            if (!isHoldMode) {
              submitResult(transcript);
            } else {
              setCurrentSpeech(prev => prev + (prev ? ' ' : '') + transcript);
            }
          } else {
            interimTranscript += transcript;
          }
        }
        
        const textField = document.querySelector('.MuiInputBase-input') as HTMLTextAreaElement;
        if (textField) {
          if (finalTranscript) {
            textField.value = isHoldMode ? currentSpeech + ' ' + finalTranscript : finalTranscript;
            textField.style.color = 'inherit';
          }
          
          if (interimTranscript) {
            textField.value = isHoldMode ? 
              currentSpeech + (currentSpeech ? ' ' : '') + interimTranscript : 
              interimTranscript;
            textField.style.color = '#666';
          }
        }
      };

      recognition.onend = () => {
        logEvent('Завершение сессии распознавания', {
          записьАктивна: isRecording,
          режим: isHoldMode ? 'удержание' : 'клик'
        });

        isRecognitionActiveRef.current = false;

        try {
          if (isRecording) {
            recognition.start();
            isRecognitionActiveRef.current = true;
          }
        } catch (error) {
          console.error('Ошибка перезапуска распознавания:', error);
        }
      };

      return () => {
        if (isRecording) {
          stopRecording();
        }
      };
    }
  }, [isRecording, stopRecording, submitResult, currentSpeech, isHoldMode]);

  const handleSend = async () => {
    if (!userInput.trim()) {
      handleError('Введите текст для отправки');
      return;
    }
    
    setLoading(true);
    try {
      console.log('Sending request to server...');
      const maxLength = 2048;
      let finalResponse = '';
      
      if (userInput.length > maxLength) {
        const chunks = userInput.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
        for (const chunk of chunks) {
          const response = await retryRequest(() => 
            api.post('/api/generate', {
              text: chunk,
              model,
            })
          );
          if (response.data.error) {
            throw new Error(response.data.error);
          }
          finalResponse += response.data.response + '\n';
        }
        setLastResponse({
          response: finalResponse,
          prompt: userInput
        });
      } else {
        const response = await retryRequest(() => 
          api.post('/api/generate', {
            text: userInput,
            model,
          })
        );
        if (response.data.error) {
          throw new Error(response.data.error);
        }
        setLastResponse(response.data);
      }
      console.log('Received response from server');
    } catch (error) {
      console.error('Error sending request:', error);
      handleError(error instanceof Error ? 
        error.message : 
        'Ошибка при обработке запроса. Проверьте консоль для деталей.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      handleError('Скопировано в буфер обмена');
    } catch (error) {
      handleError('Ошибка при копировании');
    }
  };

  const handleEditPrompt = async () => {
    try {
      console.log('Загружаем промпт для редактирования...');
      const response = await retryRequest(() => api.get('/api/prompt'));
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      
      // Устанавливаем промпт для редактирования
      setPrompt(response.data.prompt);
      
      // Если есть конфигурация, обновляем её
      if (response.data.config) {
        setCommandConfig(response.data.config);
        console.log('Загружена конфигурация для редактирования:', response.data.config);
      }
      
      setPromptOpen(true);
      console.log('Промпт загружен для редактирования:', response.data.prompt.substring(0, 100) + '...');
    } catch (error) {
      console.error('Ошибка при загрузке промпта:', error);
      handleError(error instanceof Error ? error.message : 'Ошибка при загрузке промпта');
    }
  };

  const handleSavePrompt = async () => {
    try {
      console.log('Сохраняем промпт:', prompt);
      
      // Если есть конфигурация, обновляем её с новым промптом
      if (commandConfig) {
        const updatedConfig = {
          ...commandConfig,
          promptText: prompt
        };
        
        const response = await retryRequest(() => api.post('/api/prompt', { 
          config: updatedConfig
        }));
        
        if (response.data.error) {
          throw new Error(response.data.error);
        }
        
        setPromptOpen(false);
        setBasePrompt(prompt);
        setCommandConfig(updatedConfig);
        
        // Обновляем уведомление
        setSnackbar({
          open: true,
          message: response.data.message || 'Промпт сохранен',
          anchorOrigin: { vertical: 'top', horizontal: 'center' }
        });
        
        console.log('Промпт успешно сохранен с конфигурацией:', response.data);
      } else {
        // Если конфигурации нет, создаем базовую конфигурацию с промптом
        const { defaultConfig } = await import('./config/defaultCommands');
        const newConfig = {
          ...defaultConfig,
          promptText: prompt
        };
        
        // Сохраняем новую конфигурацию
        const response = await retryRequest(() => api.post('/api/prompt', { 
          config: newConfig
        }));
        
        if (response.data.error) {
          throw new Error(response.data.error);
        }
        
        setPromptOpen(false);
        setBasePrompt(prompt);
        setCommandConfig(newConfig);
        
        // Обновляем уведомление
        setSnackbar({
          open: true,
          message: response.data.message || 'Промпт сохранен',
          anchorOrigin: { vertical: 'top', horizontal: 'center' }
        });
        
        console.log('Промпт успешно сохранен с новой конфигурацией:', response.data);
      }
    } catch (error) {
      console.error('Ошибка при сохранении промпта:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Ошибка при сохранении промпта',
        anchorOrigin: { vertical: 'top', horizontal: 'center' }
      });
    }
  };

  // Функция для визуализации команд из JSON
  const visualizeCommands = (jsonText: string) => {
    try {
      const commands = JSON.parse(jsonText);
      
      // Эмодзи для разных типов команд
      const commandEmojis: {[key: string]: string} = {
        'cut': '✂️',
        'tools': '🔧',
        'hide_video_layer': '👁️',
        'save': '💾',
        'render': '🎬',
        'undo': '↩️',
        'redo': '↪️',
        'select_audio_track': '🔊',
        'select_video_track': '🎥'
      };
      
      // Визуализация графа последовательности команд
      const renderCommandGraph = () => {
        return (
          <Box sx={{ mt: 3, mb: 4, position: 'relative', minHeight: '120px' }}>
            <Typography variant="subtitle2" gutterBottom>Последовательность выполнения:</Typography>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              position: 'relative',
              py: 2,
              px: 1
            }}>
              {/* Линия соединяющая команды */}
              <Box sx={{ 
                position: 'absolute', 
                height: '2px', 
                background: 'linear-gradient(to right, #4a90e2, #4a90e2)',
                width: `calc(100% - ${commands.length > 1 ? 60 : 30}px)`, 
                left: '30px',
                top: '50%',
                zIndex: 1
              }} />
              
              {/* Прогресс выполнения */}
              {activeStep > 0 && (
                <Box sx={{ 
                  position: 'absolute', 
                  height: '4px', 
                  backgroundColor: '#2ecc71', 
                  width: `${(activeStep / (commands.length - 1)) * (100 - (commands.length > 1 ? 60 : 30) / (commands.length * 0.01))}%`, 
                  left: '30px',
                  top: 'calc(50% - 1px)',
                  zIndex: 2,
                  transition: 'width 0.5s ease-in-out',
                  borderRadius: '2px'
                }} />
              )}
              
              {/* Команды на графе */}
              {commands.map((cmd: any, index: number) => (
                <Box key={index} sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  position: 'relative',
                  zIndex: 3,
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease'
                }}
                onClick={() => setActiveStep(index)}
                onMouseEnter={() => setActiveStep(index)}
                >
                  <Box sx={{ 
                    width: 50, 
                    height: 50, 
                    borderRadius: '50%', 
                    backgroundColor: 'white',
                    border: `2px solid ${activeStep === index ? '#2ecc71' : activeStep > index ? '#8e44ad' : '#4a90e2'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    boxShadow: activeStep === index 
                      ? '0 0 0 4px rgba(46, 204, 113, 0.3), 0 4px 12px rgba(0,0,0,0.15)' 
                      : '0 2px 8px rgba(0,0,0,0.1)',
                    mb: 1,
                    transform: activeStep === index ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.3s ease'
                  }}>
                    {commandEmojis[cmd.command.split(' ')[0]] || '🔹'}
                  </Box>
                  <Typography variant="caption" sx={{ 
                    textAlign: 'center', 
                    maxWidth: '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: activeStep === index ? 'bold' : 'normal',
                    color: activeStep === index ? '#2ecc71' : 'inherit'
                  }}>
                    {cmd.command.split(' ')[0]}
                  </Typography>
                  <Typography variant="caption" sx={{ 
                    fontSize: '10px', 
                    color: activeStep === index ? '#2ecc71' : 'text.secondary',
                    fontWeight: activeStep === index ? 'bold' : 'normal'
                  }}>
                    Шаг {index + 1}
                  </Typography>
                  
                  {/* Описание команды при наведении */}
                  {activeStep === index && (
                    <Box sx={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: 'white',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      zIndex: 10,
                      width: '200px',
                      mt: 1,
                      border: '1px solid #eee'
                    }}>
                      <Typography variant="body2" fontWeight="bold">
                        {cmd.command}
                      </Typography>
                      {Object.keys(cmd.parameters).length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          {Object.entries(cmd.parameters).map(([key, value]) => (
                            <Typography key={key} variant="caption" display="block">
                              {key}: <strong>{String(value)}</strong>
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
            
            {/* Кнопки управления анимацией */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 2 }}>
              <Button 
                size="small" 
                variant="outlined" 
                onClick={() => {
                  setActiveStep(-1);
                  setTimeout(() => {
                    let step = 0;
                    const interval = setInterval(() => {
                      if (step < commands.length) {
                        setActiveStep(step);
                        step++;
                      } else {
                        clearInterval(interval);
                      }
                    }, 800);
                  }, 300);
                }}
              >
                Воспроизвести
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                onClick={() => setActiveStep(-1)}
              >
                Сбросить
              </Button>
            </Box>
          </Box>
        );
      };
      
      return (
        <div>
          {commands.length > 1 && renderCommandGraph()}
          <Typography variant="h6" gutterBottom>Распознанные команды:</Typography>
          {commands.map((cmd: any, index: number) => (
            <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'rgba(74, 144, 226, 0.1)', borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {commandEmojis[cmd.command.split(' ')[0]] || '🔹'} {cmd.command} (уверенность: {(cmd.confidence * 100).toFixed(1)}%)
              </Typography>
              {Object.keys(cmd.parameters).length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2">Параметры:</Typography>
                  {Object.entries(cmd.parameters).map(([key, value]) => (
                    <Typography key={key} variant="body2">
                      🔸 {key}: <strong>{String(value)}</strong>
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </div>
      );
    } catch (e) {
      return jsonText;
    }
  };

  // Функция для определения цвета кнопки
  const getFabColor = () => {
    if (!canStartRecording) return 'inherit';
    if (!isRecording) return 'primary';
    return isHoldMode ? 'success' : 'secondary';
  };

  // Добавим новую функцию для сохранения конфигурации команд
  const handleSaveCommandConfig = async (config: PromptConfig) => {
    try {
      // Генерируем текст промпта из конфигурации
      const promptText = generatePromptText(config);
      
      // Добавляем promptText в конфигурацию
      const configWithPrompt = {
        ...config,
        promptText: promptText
      };
      
      console.log('Сохраняем конфигурацию команд:', configWithPrompt);
      
      const response = await api.post('/api/prompt', {
        config: configWithPrompt
      });
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      
      setSnackbar({
        open: true,
        message: 'Конфигурация команд успешно сохранена',
        anchorOrigin: { vertical: 'top', horizontal: 'center' }
      });
      
      setIsCommandEditorOpen(false);
      
      // Обновляем локальное состояние
      setCommandConfig(configWithPrompt);
      setBasePrompt(promptText);
      setPrompt(promptText); // Обновляем также текущий промпт в редакторе
      
      console.log('Конфигурация команд успешно сохранена:', response.data);
    } catch (error) {
      console.error('Ошибка при сохранении конфигурации команд:', error);
      setSnackbar({
        open: true,
        message: `Ошибка при сохранении конфигурации: ${error}`,
        anchorOrigin: { vertical: 'top', horizontal: 'center' }
      });
    }
  };

  // Функция для генерации текста промпта
  const generatePromptText = (config: PromptConfig): string => {
    let promptText = `${config.role}\n\nДоступные команды:\n`;
    
    config.commands.forEach((cmd, index) => {
      promptText += `${index + 1}. ${cmd.className} - ${cmd.description}\n`;
      if (cmd.examples.length > 0) {
        promptText += '   Примеры:\n';
        cmd.examples.forEach(example => {
          promptText += `   - "${example}"\n`;
        });
      }
      if (cmd.parameters.length > 0) {
        promptText += '   Параметры:\n';
        cmd.parameters.forEach(param => {
          promptText += `     - ${param.name}: ${param.description}\n`;
        });
      }
      promptText += '\n';
    });

    return promptText;
  };

  // Функция сохранения новой горячей клавиши
  const handleSaveHotkey = () => {
    if (tempHotkey) {
      setHotkey(tempHotkey);
      localStorage.setItem('voiceHotkey', tempHotkey);
      setTempHotkey('');
    }
    setIsHotkeyDialogOpen(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <Box 
        sx={{ 
          minHeight: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
          backgroundColor: '#f5f7fa'
        }}
      >
        <Container maxWidth="md">
          <Paper 
            elevation={3} 
            sx={{ 
              p: 4, 
              borderRadius: 4, 
              backgroundColor: 'white',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              transition: 'box-shadow 0.3s ease',
              '&:hover': {
                boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
              }
            }}
          >
            <Typography 
              variant="h5" 
              gutterBottom 
              sx={{ 
                textAlign: 'center', 
                mb: 3, 
                fontWeight: 600,
                color: '#2c3e50'
              }}
            >
              Отправить запрос
            </Typography>
            
            <Box sx={{ position: 'relative', mb: 3 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={isRecording ? `${userInput}${interimTranscript ? ' ' + interimTranscript : ''}` : userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Введите текст здесь..."
                disabled={loading}
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    fontSize: '16px',
                    lineHeight: 1.6,
                    '& .MuiInputBase-input': {
                      color: isRecording ? 'text.secondary' : 'text.primary',
                    }
                  }
                }}
              />
              <Box 
                sx={{ 
                  position: 'relative',
                  '& .MuiSelect-select': {
                    pointerEvents: 'auto'
                  },
                  '& .MuiSelect-root': {
                    zIndex: 2
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <AudioMeter audioLevel={audioLevel} audioDevice={audioDevice} />
                <Fab
                  color={getFabColor()}
                  size="small"
                  onClick={handleVoiceRecord}
                  disabled={!canStartRecording}
                  sx={{
                    position: 'absolute',
                    right: 16,
                    bottom: 32,
                    boxShadow: isRecording ? '0 0 8px rgba(244,67,54,0.5)' : 'none',
                    animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                    opacity: canStartRecording ? 1 : 0.7,
                    transition: 'opacity 0.3s ease',
                    '@keyframes pulse': {
                      '0%': {
                        boxShadow: '0 0 0 0 rgba(244,67,54,0.4)',
                      },
                      '70%': {
                        boxShadow: '0 0 0 10px rgba(244,67,54,0)',
                      },
                      '100%': {
                        boxShadow: '0 0 0 0 rgba(244,67,54,0)',
                      },
                    },
                  }}
                >
                  <MicIcon />
                </Fab>
              </Box>
            </Box>

            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <Select
                value={model}
                onChange={(e) => setModel(e.target.value as string)}
                size="small"
                sx={{ 
                  minWidth: 200,
                  height: 40,
                  borderRadius: 20,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderRadius: 20,
                  }
                }}
              >
                <MenuItem value="llama">Gemini 1.5 Flash</MenuItem>
                <MenuItem value="gemini-1.5-flash">Llama 3.3 70B (Yandex Cloud)</MenuItem>
              </Select>

              <Tooltip 
                title={
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    <Typography variant="caption">Базовый промпт:</Typography>
                    <Typography variant="body2">{basePrompt}</Typography>
                    <Typography variant="caption" sx={{ mt: 1 }}>Ваш текст:</Typography>
                    <Typography variant="body2">{userInput}</Typography>
                    {loading && (
                      <Typography variant="caption" color="primary">
                        Идет обработка запроса...
                      </Typography>
                    )}
                  </div>
                }
                arrow
                placement="top"
                enterDelay={200}
                leaveDelay={200}
                componentsProps={{
                  popper: {
                    sx: {
                      '& .MuiTooltip-tooltip': {
                        maxWidth: 500,
                      },
                    },
                  },
                }}
              >
                <span>
                  <Button
                    variant="contained"
                    onClick={handleSend}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                    sx={{ 
                      minWidth: 140,
                      height: 40,
                      fontWeight: 500
                    }}
                  >
                    Отправить
                  </Button>
                </span>
              </Tooltip>

              <IconButton 
                onClick={() => lastResponse && setResultOpen(true)}
                disabled={!lastResponse}
                color="primary"
                sx={{ 
                  width: 40, 
                  height: 40,
                  backgroundColor: lastResponse ? 'rgba(74, 144, 226, 0.1)' : 'transparent'
                }}
              >
                <HistoryIcon />
              </IconButton>

              <IconButton 
                onClick={() => setIsCommandEditorOpen(true)}
                color="primary"
                sx={{ 
                  width: 40, 
                  height: 40,
                  backgroundColor: 'rgba(74, 144, 226, 0.1)'
                }}
              >
                <EditIcon />
              </IconButton>

              <Tooltip title="Настроить горячую клавишу">
                <IconButton 
                  onClick={() => setIsHotkeyDialogOpen(true)}
                  color="primary"
                  sx={{ 
                    width: 40, 
                    height: 40,
                    backgroundColor: 'rgba(74, 144, 226, 0.1)'
                  }}
                >
                  <KeyboardIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>
          
          {/* Добавим блок для визуализации команд под основным блоком */}
          {lastResponse && (() => {
            const { isJson, formatted } = formatJsonResponse(lastResponse.response);
            if (isJson) {
              return (
                <Paper 
                  elevation={2} 
                  sx={{ 
                    mt: 3, 
                    p: 3, 
                    borderRadius: 4,
                    backgroundColor: 'white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  }}
                >
                  {visualizeCommands(formatted)}
                </Paper>
              );
            }
            return null;
          })()}
        </Container>

        <Dialog open={resultOpen} onClose={() => setResultOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ m: 0, p: 2 }}>
            Результат
            <IconButton
              onClick={() => setResultOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {lastResponse && (
              <>
                <Typography variant="h6" gutterBottom>
                  Запрос:
                </Typography>
                <Typography paragraph>{lastResponse.prompt}</Typography>
                <Typography variant="h6" gutterBottom>
                  Ответ:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  {(() => {
                    const { isJson, formatted } = formatJsonResponse(lastResponse.response);
                    return isJson ? (
                      <pre style={{ 
                        flex: 1, 
                        overflow: 'auto', 
                        backgroundColor: '#f5f5f5', 
                        padding: '12px', 
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '16px',
                        lineHeight: '1.5'
                      }}>
                        {formatted}
                      </pre>
                    ) : (
                      <Typography sx={{ flex: 1, fontSize: '16px' }}>{lastResponse.response}</Typography>
                    );
                  })()}
                  <IconButton onClick={() => {
                    const { isJson, formatted } = formatJsonResponse(lastResponse.response);
                    handleCopy(isJson ? formatted : lastResponse.response);
                  }} size="small">
                    <CopyIcon />
                  </IconButton>
                </Box>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={promptOpen} onClose={() => setPromptOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Редактирование промпта</DialogTitle>
          <DialogContent dividers>
            <TextField
              fullWidth
              multiline
              rows={8}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              variant="outlined"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPromptOpen(false)}>Отмена</Button>
            <Button onClick={handleSavePrompt} variant="contained">
              Сохранить
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog 
          open={isCommandEditorOpen} 
          onClose={() => setIsCommandEditorOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            Редактор команд
            <IconButton
              onClick={() => setIsCommandEditorOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <CommandEditor 
              onSave={handleSaveCommandConfig} 
              initialConfig={commandConfig}
              onClose={() => setIsCommandEditorOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog 
          open={isHotkeyDialogOpen} 
          onClose={() => {
            setIsHotkeyDialogOpen(false);
            setIsListeningForHotkey(false);
            setTempHotkey('');
          }}
        >
          <DialogTitle>Настройка горячей клавиши</DialogTitle>
          <DialogContent>
            <Box sx={{ p: 2 }}>
              <Typography gutterBottom>
                Текущая клавиша: <strong>{hotkey}</strong>
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  setIsListeningForHotkey(true);
                  setTempHotkey('');
                }}
                sx={{ mt: 2 }}
              >
                {isListeningForHotkey ? 'Нажмите любую клавишу...' : 'Изменить клавишу'}
              </Button>
              {tempHotkey && (
                <Typography sx={{ mt: 2 }}>
                  Новая клавиша: <strong>{tempHotkey}</strong>
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setIsHotkeyDialogOpen(false);
              setIsListeningForHotkey(false);
              setTempHotkey('');
            }}>
              Отмена
            </Button>
            <Button 
              onClick={handleSaveHotkey}
              variant="contained"
              disabled={!tempHotkey}
            >
              Сохранить
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          message={snackbar.message}
          anchorOrigin={snackbar.anchorOrigin}
        />
      </Box>
    </ThemeProvider>
  );
}

export default App;
