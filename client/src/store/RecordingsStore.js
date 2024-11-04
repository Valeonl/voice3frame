import { create } from 'zustand';

const useRecordingsStore = create((set, get) => ({
  recordings: [],
  totalRecordings: 0,
  isLoading: false,

  // Добавление записи
  addRecording: (recording) => {
    set(state => ({
      recordings: [{
        ...recording,
        processing: true,
        timestamp: new Date().toLocaleString()
      }, ...state.recordings],
      totalRecordings: state.totalRecordings + 1
    }));
  },

  // Обновление записи
  updateRecording: (filename, updates) => {
    set(state => {
      const updatedRecordings = state.recordings.map(rec => 
        rec.filename === filename ? { ...rec, ...updates } : rec
      );
      console.log('Обновление записи:', filename, updates, updatedRecordings);
      return { recordings: updatedRecordings };
    });
  },

  // Удаление записи
  removeRecording: (filename) => {
    set(state => ({
      recordings: state.recordings.filter(r => r.filename !== filename),
      totalRecordings: state.totalRecordings - 1
    }));
  },

  // Очистка всех записей
  clearRecordings: () => {
    set({
      recordings: [],
      totalRecordings: 0
    });
  },

  // Синхронизация с сервером
  syncWithServer: async () => {
    const state = get();
    if (state.isLoading) return;

    set({ isLoading: true });
    try {
      const response = await fetch('http://localhost:5000/api/recordings');
      const data = await response.json();
      
      if (data.recordings) {
        // Обновляем записи, сохраняя состояние обработки и расшифровки
        const updatedRecordings = data.recordings.map(newRec => {
          const existingRec = state.recordings.find(r => r.filename === newRec.filename);
          return {
            ...newRec,
            processing: existingRec?.processing || false,
            transcription: newRec.transcription || existingRec?.transcription
          };
        });

        set({
          recordings: updatedRecordings,
          totalRecordings: data.total
        });
      }
    } catch (error) {
      console.error('Ошибка синхронизации:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // Завершение обработки записи
  finishProcessing: (filename) => {
    set(state => ({
      recordings: state.recordings.map(rec => 
        rec.filename === filename ? { ...rec, processing: false } : rec
      )
    }));
  }
}));

export default useRecordingsStore; 