import { create } from 'zustand';

const useAudioPlayerStore = create((set, get) => ({
  currentAudio: null,
  currentFileName: null,

  playAudio: async (audio, fileName) => {
    const state = get();
    
    // Сначала останавливаем текущее воспроизведение
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.currentTime = 0;
      state.currentAudio = null;
      set({ currentAudio: null, currentFileName: null });
      
      // Если это тот же файл, просто останавливаем
      if (state.currentFileName === fileName) {
        return;
      }
      
      // Даем небольшую паузу перед началом нового воспроизведения
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {
      // Начинаем новое воспроизведение
      await audio.play();
      set({ 
        currentAudio: audio,
        currentFileName: fileName
      });

      // Добавляем обработчик окончания воспроизведения
      audio.onended = () => {
        set({ 
          currentAudio: null,
          currentFileName: null
        });
      };
    } catch (error) {
      console.error('Ошибка воспроизведения:', error);
      set({ 
        currentAudio: null,
        currentFileName: null
      });
    }
  },

  stopAudio: () => {
    const state = get();
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.currentTime = 0;
    }
    set({ 
      currentAudio: null,
      currentFileName: null
    });
  },

  isPlayingFile: (fileName) => {
    const state = get();
    return state.currentFileName === fileName;
  }
}));

export default useAudioPlayerStore; 