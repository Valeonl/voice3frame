import json
import logging
from typing import Dict, Any, List, Optional, Union

# Настройка логирования
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('premiere_controller')

try:
    import pymiere
    from pymiere import wrappers
    from pymiere.wrappers import time_from_seconds, timecode_from_time
    PYMIERE_AVAILABLE = True
    logger.info("Библиотека pymiere успешно импортирована")
except ImportError:
    PYMIERE_AVAILABLE = False
    logger.warning("Не удалось импортировать библиотеку pymiere. Будет использован режим эмуляции.")

class PremiereController:
    """
    Контроллер для управления Adobe Premiere Pro через pymiere
    """
    def __init__(self):
        self.connected = False
        if PYMIERE_AVAILABLE:
            try:
                # Проверяем соединение с Premiere Pro
                app = pymiere.objects.app
                self.connected = app is not None
                if self.connected:
                    logger.info(f"Подключено к Adobe Premiere Pro {app.version}")
                    # Получаем активный проект
                    self.project = app.project
                    if self.project:
                        logger.info(f"Активный проект: {self.project.name}")
                    else:
                        logger.warning("Нет активного проекта в Premiere Pro")
                        self.connected = False
            except Exception as e:
                logger.error(f"Ошибка при подключении к Premiere Pro: {str(e)}")
                self.connected = False
        else:
            logger.warning("Работа в режиме эмуляции (без подключения к Premiere Pro)")

    
    
    def hide_video_track(self, track_index: int) -> Dict[str, Any]:
        """
        Скрывает видеодорожку
        
        Args:
            track_index: Индекс видеодорожки (начиная с 1)
                
        Returns:
            Результат выполнения команды
        """
        if not self.connected:
            return self._emulate_hide_video_track(track_index)
        
        try:
            # Получаем активную последовательность
            sequence = self.project.activeSequence
            if not sequence:
                return {"status": "error", "message": "Нет активной последовательности"}
            
            # Получаем видеодорожки
            video_tracks = sequence.videoTracks
            
            # Преобразуем индекс (пользовательский, начиная с 1) в индекс массива (начиная с 0)
            array_index = track_index - 1
            
            # Проверяем, что индекс в допустимом диапазоне
            if array_index < 0 or array_index >= video_tracks.numTracks:
                return {
                    "status": "error", 
                    "message": f"Недопустимый индекс видеодорожки: {track_index}. Доступно: 1-{video_tracks.numTracks}"
                }
            
            # Скрываем видеодорожку
            video_tracks[array_index].setMute(1)
            
            return {
                "status": "success", 
                "message": f"Видеодорожка {track_index} скрыта"
            }
            
        except Exception as e:
            logger.error(f"Ошибка при скрытии видеодорожки: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def show_video_track(self, track_index: int) -> Dict[str, Any]:
        """
        Показывает видеодорожку
        
        Args:
            track_index: Индекс видеодорожки (начиная с 1)
                
        Returns:
            Результат выполнения команды
        """
        if not self.connected:
            return self._emulate_show_video_track(track_index)
        
        try:
            # Получаем активную последовательность
            sequence = self.project.activeSequence
            if not sequence:
                return {"status": "error", "message": "Нет активной последовательности"}
            
            # Получаем видеодорожки
            video_tracks = sequence.videoTracks
            
            # Преобразуем индекс (пользовательский, начиная с 1) в индекс массива (начиная с 0)
            array_index = track_index - 1
            
            # Проверяем, что индекс в допустимом диапазоне
            if array_index < 0 or array_index >= video_tracks.numTracks:
                return {
                    "status": "error", 
                    "message": f"Недопустимый индекс видеодорожки: {track_index}. Доступно: 1-{video_tracks.numTracks}"
                }
            
            # Показываем видеодорожку
            video_tracks[array_index].setMute(0)
            
            return {
                "status": "success", 
                "message": f"Видеодорожка {track_index} показана"
            }
            
        except Exception as e:
            logger.error(f"Ошибка при отображении видеодорожки: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def mute_audio_track(self, track_index: int) -> Dict[str, Any]:
        """
        Заглушает аудиодорожку
        
        Args:
            track_index: Индекс аудиодорожки (начиная с 1)
                
        Returns:
            Результат выполнения команды
        """
        if not self.connected:
            return self._emulate_mute_audio_track(track_index)
        
        try:
            # Получаем активную последовательность
            sequence = self.project.activeSequence
            if not sequence:
                return {"status": "error", "message": "Нет активной последовательности"}
            
            # Получаем аудиодорожки
            audio_tracks = sequence.audioTracks
            
            # Преобразуем индекс (пользовательский, начиная с 1) в индекс массива (начиная с 0)
            array_index = track_index - 1
            
            # Проверяем, что индекс в допустимом диапазоне
            if array_index < 0 or array_index >= audio_tracks.numTracks:
                return {
                    "status": "error", 
                    "message": f"Недопустимый индекс аудиодорожки: {track_index}. Доступно: 1-{audio_tracks.numTracks}"
                }
            
            # Заглушаем аудиодорожку
            try:
                # Пытаемся использовать прямой метод
                audio_tracks[array_index].setMute(1)
            except Exception as e:
                logger.warning(f"Не удалось использовать метод setMute: {str(e)}")
                # Если прямой метод не работает, используем другой подход
                # Сначала выбираем дорожку
                for i in range(audio_tracks.numTracks):
                    audio_tracks[i].setTargeted(i == array_index, True)
                
                # Затем применяем команду заглушения через executeCommand
                if hasattr(pymiere.objects.app, 'executeCommand'):
                    pymiere.objects.app.executeCommand("ToggleTrackMute")
                else:
                    logger.warning("Метод executeCommand недоступен в pymiere.objects.app")
                    # Используем альтернативный подход
                    audio_tracks[array_index].setEnabled(False)
            
            return {
                "status": "success", 
                "message": f"Аудиодорожка {track_index} заглушена"
            }
            
        except Exception as e:
            logger.error(f"Ошибка при заглушении аудиодорожки: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def unmute_audio_track(self, track_index: int) -> Dict[str, Any]:
        """
        Включает звук аудиодорожки
        
        Args:
            track_index: Индекс аудиодорожки (начиная с 1)
                
        Returns:
            Результат выполнения команды
        """
        if not self.connected:
            return self._emulate_unmute_audio_track(track_index)
        
        try:
            # Получаем активную последовательность
            sequence = self.project.activeSequence
            if not sequence:
                return {"status": "error", "message": "Нет активной последовательности"}
            
            # Получаем аудиодорожки
            audio_tracks = sequence.audioTracks
            
            # Преобразуем индекс (пользовательский, начиная с 1) в индекс массива (начиная с 0)
            array_index = track_index - 1
            
            # Проверяем, что индекс в допустимом диапазоне
            if array_index < 0 or array_index >= audio_tracks.numTracks:
                return {
                    "status": "error", 
                    "message": f"Недопустимый индекс аудиодорожки: {track_index}. Доступно: 1-{audio_tracks.numTracks}"
                }
            
            # Включаем звук аудиодорожки
            try:
                # Пытаемся использовать прямой метод
                audio_tracks[array_index].setMute(0)
            except Exception as e:
                logger.warning(f"Не удалось использовать метод setMute: {str(e)}")
                # Если прямой метод не работает, используем другой подход
                # Сначала выбираем дорожку
                for i in range(audio_tracks.numTracks):
                    audio_tracks[i].setTargeted(i == array_index, True)
                
                # Проверяем, заглушена ли дорожка
                is_muted = False
                try:
                    is_muted = audio_tracks[array_index].isMuted()
                except:
                    # Если метод isMuted недоступен, предполагаем, что дорожка заглушена
                    is_muted = True
                
                # Если дорожка заглушена, включаем звук
                if is_muted:
                    # Затем применяем команду включения звука через executeCommand
                    if hasattr(pymiere.objects.app, 'executeCommand'):
                        pymiere.objects.app.executeCommand("ToggleTrackMute")
                    else:
                        logger.warning("Метод executeCommand недоступен в pymiere.objects.app")
                        # Используем альтернативный подход
                        audio_tracks[array_index].setEnabled(True)
            
            return {
                "status": "success", 
                "message": f"Звук аудиодорожки {track_index} включен"
            }
            
        except Exception as e:
            logger.error(f"Ошибка при включении звука аудиодорожки: {str(e)}")
            return {"status": "error", "message": str(e)}

    def cut_track(self, track_type: str, track_index: int, start_time: float, end_time: float) -> Dict[str, Any]:
        """
        Обрезка аудио или видео дорожки.

        Args:
            track_type: Тип дорожки ('audio' или 'video')
            track_index: Индекс дорожки (начиная с 1)
            start_time: Начальное время обрезки (в секундах) или None
            end_time: Конечное время обрезки (в секундах) или None

        Returns:
            Результат выполнения команды
        """
        if not self.connected:
            return self._emulate_cut_track(track_type, track_index, start_time, end_time)

        try:
            # Получаем активную последовательность
            sequence = self.project.activeSequence
            if not sequence:
                return {"status": "error", "message": "Нет активной последовательности"}

            # Получаем нужные дорожки
            if track_type == 'audio':
                tracks = sequence.audioTracks
            elif track_type == 'video':
                tracks = sequence.videoTracks
            else:
                return {"status": "error", "message": "Неверный тип дорожки"}

            # Преобразуем индекс (пользовательский, начиная с 1) в индекс массива (начиная с 0)
            array_index = track_index - 1

            # Проверяем, что индекс в допустимом диапазоне
            if array_index < 0 or array_index >= tracks.numTracks:
                return {
                    "status": "error",
                    "message": f"Недопустимый индекс дорожки: {track_index}. Доступно: 1-{tracks.numTracks}"
                }

            # Получаем дорожку через QE API
            qe_sequence = pymiere.objects.qe.project.getActiveSequence()
            qe_track = qe_sequence.getAudioTrackAt(array_index) if track_type == 'audio' else qe_sequence.getVideoTrackAt(array_index)

            # Если start_time указан, а end_time = None, используем только start_time
            if start_time is not None and end_time is None:
                start_time_obj = time_from_seconds(start_time)
                start_timecode = timecode_from_time(start_time_obj, sequence)
                qe_track.razor(start_timecode)
                return {
                    "status": "success",
                    "message": f"Дорожка {track_type} {track_index} обрезана по времени {start_time} секунд"
                }

            # Преобразуем секунды в объекты Time
            start_time_obj = time_from_seconds(start_time) if start_time is not None else None
            end_time_obj = time_from_seconds(end_time) if end_time is not None else None

            if start_time_obj is not None and end_time_obj is not None:
                # Преобразуем объекты Time в строки таймкодов
                start_timecode = timecode_from_time(start_time_obj, sequence)
                end_timecode = timecode_from_time(end_time_obj, sequence)

                # Обрезка дорожки
                qe_track.razor(start_timecode)
                qe_track.razor(end_timecode)

                return {
                    "status": "success",
                    "message": f"Дорожка {track_type} {track_index} обрезана с {start_time} до {end_time} секунд"
                }

            return {
                "status": "error",
                "message": "Некорректные временные параметры для обрезки."
            }

        except Exception as e:
            logger.error(f"Ошибка при обрезке дорожки: {str(e)}")
            return {"status": "error", "message": str(e)}


    def deselect_all_tracks(self) -> Dict[str, Any]:
        """
        Снимает выделение со всех дорожек.

        Returns:
            Результат выполнения команды
        """
        if not self.connected:
            return self._emulate_deselect_all_tracks()

        try:
            # Получаем активную последовательность
            sequence = self.project.activeSequence
            if not sequence:
                return {"status": "error", "message": "Нет активной последовательности"}

            # Получаем все дорожки
            video_tracks = sequence.videoTracks
            audio_tracks = sequence.audioTracks

            # Снимаем выделение с каждого клипа на всех дорожках
            for track in video_tracks:
                for clip in track.clips:
                    clip.setSelected(False, updateUI=True)

            for track in audio_tracks:
                for clip in track.clips:
                    clip.setSelected(False, updateUI=True)

            return {
                "status": "success",
                "message": "Выделение со всех дорожек снято"
            }

        except Exception as e:
            logger.error(f"Ошибка при снятии выделения со всех дорожек: {str(e)}")
            return {"status": "error", "message": str(e)}

    def deselect_track(self, track_type: str, track_index: Optional[int]) -> Dict[str, Any]:
        """
        Снимает выделение с дорожки.

        Args:
            track_type: Тип дорожки ('audio' или 'video')
            track_index: Индекс дорожки (начиная с 1) или None для всех дорожек

        Returns:
            Результат выполнения команды
        """
        if not self.connected:
            return self._emulate_deselect_track(track_type, track_index)

        try:
            # Получаем активную последовательность
            sequence = self.project.activeSequence
            if not sequence:
                return {"status": "error", "message": "Нет активной последовательности"}

            # Получаем нужные дорожки
            if track_type == 'audio':
                tracks = sequence.audioTracks
            elif track_type == 'video':
                tracks = sequence.videoTracks
            else:
                return {"status": "error", "message": "Неверный тип дорожки"}

            # Если track_index не указан, снимаем выделение со всех дорожек
            if track_index is None:
                for track in tracks:
                    for clip in track.clips:
                        clip.setSelected(False, updateUI=True)
                return {
                    "status": "success",
                    "message": f"Выделение со всех {track_type} дорожек снято"
                }

            # Преобразуем индекс (пользовательский, начиная с 1) в индекс массива (начиная с 0)
            array_index = track_index - 1

            # Проверяем, что индекс в допустимом диапазоне
            if array_index < 0 or array_index >= tracks.numTracks:
                return {
                    "status": "error",
                    "message": f"Недопустимый индекс дорожки: {track_index}. Доступно: 1-{tracks.numTracks}"
                }

            track = tracks[array_index]

            # Снимаем выделение с каждого клипа на дорожке
            for clip in track.clips:
                clip.setSelected(False, updateUI=True)

            return {
                "status": "success",
                "message": f"Выделение с {track_type} дорожки {track_index} снято"
            }

        except Exception as e:
            logger.error(f"Ошибка при снятии выделения с дорожки: {str(e)}")
            return {"status": "error", "message": str(e)}

    def select_track(self, track_type: str, track_index: int, fragment_index: Union[str, List[int], int]) -> Dict[str, Any]:
        """
        Выделяет дорожку или фрагменты на дорожке.

        Args:
            track_type: Тип дорожки ('audio' или 'video')
            track_index: Индекс дорожки (начиная с 1)
            fragment_index: Индекс фрагмента (начиная с 1) или "all" для всех фрагментов,
                           или список индексов фрагментов для множественного выделения

        Returns:
            Результат выполнения команды
        """
        if not self.connected:
            return self._emulate_select_track(track_type, track_index, fragment_index)

        try:
            # Получаем активную последовательность
            sequence = self.project.activeSequence
            if not sequence:
                return {"status": "error", "message": "Нет активной последовательности"}

            # Получаем нужные дорожки
            if track_type == 'audio':
                tracks = sequence.audioTracks
            elif track_type == 'video':
                tracks = sequence.videoTracks
            else:
                return {"status": "error", "message": "Неверный тип дорожки"}

            # Преобразуем индекс (пользовательский, начиная с 1) в индекс массива (начиная с 0)
            array_index = track_index - 1

            # Проверяем, что индекс в допустимом диапазоне
            if array_index < 0 or array_index >= tracks.numTracks:
                return {
                    "status": "error",
                    "message": f"Недопустимый индекс дорожки: {track_index}. Доступно: 1-{tracks.numTracks}"
                }

            track = tracks[array_index]

            # Если fragment_index равен "all", выделяем все фрагменты на дорожке
            if fragment_index == "all":
                for clip in track.clips:
                    clip.setSelected(True, updateUI=True)
                return {
                    "status": "success",
                    "message": f"Все фрагменты на {track_type} дорожке {track_index} выделены"
                }

            # Если fragment_index - это список индексов
            if isinstance(fragment_index, (list, tuple)) or (isinstance(fragment_index, str) and fragment_index.startswith('[') and fragment_index.endswith(']')):
                # Если fragment_index - строка в формате "[1,2,3]", преобразуем её в список
                if isinstance(fragment_index, str):
                    try:
                        fragment_indices = json.loads(fragment_index)
                    except json.JSONDecodeError:
                        return {"status": "error", "message": f"Неверный формат списка фрагментов: {fragment_index}"}
                else:
                    fragment_indices = fragment_index

                # Проверяем каждый индекс и выделяем соответствующие фрагменты
                selected_fragments = []
                for idx in fragment_indices:
                    try:
                        fragment_array_index = int(idx) - 1
                        if 0 <= fragment_array_index < len(track.clips):
                            track.clips[fragment_array_index].setSelected(True, updateUI=True)
                            selected_fragments.append(idx)
                    except (ValueError, TypeError):
                        logger.warning(f"Пропущен некорректный индекс фрагмента: {idx}")
                        continue

                if selected_fragments:
                    return {
                        "status": "success",
                        "message": f"Фрагменты {', '.join(map(str, selected_fragments))} на {track_type} дорожке {track_index} выделены"
                    }
                else:
                    return {
                        "status": "error",
                        "message": "Не удалось выделить ни один фрагмент"
                    }

            # Если fragment_index - одиночное число
            try:
                fragment_array_index = int(fragment_index) - 1
            except (ValueError, TypeError):
                return {"status": "error", "message": f"Неверный индекс фрагмента: {fragment_index}"}

            if fragment_array_index < 0 or fragment_array_index >= len(track.clips):
                return {
                    "status": "error",
                    "message": f"Недопустимый индекс фрагмента: {fragment_index}. Доступно: 1-{len(track.clips)}"
                }

            # Выделяем указанный фрагмент
            track.clips[fragment_array_index].setSelected(True, updateUI=True)

            return {
                "status": "success",
                "message": f"Фрагмент {fragment_index} на {track_type} дорожке {track_index} выделен"
            }

        except Exception as e:
            logger.error(f"Ошибка при выделении дорожки или фрагмента: {str(e)}")
            return {"status": "error", "message": str(e)}

    def _emulate_deselect_all_tracks(self) -> Dict[str, Any]:
        """
        Эмулирует выполнение команды снятия выделения со всех дорожек
        """
        message = "[ЭМУЛЯЦИЯ] Выделение со всех дорожек снято"
        logger.info(message)
        return {"status": "success", "message": message}

    def _emulate_deselect_track(self, track_type: str, track_index: Optional[int]) -> Dict[str, Any]:
        """
        Эмулирует выполнение команды снятия выделения с дорожки
        """
        message = f"[ЭМУЛЯЦИЯ] Выделение с {track_type} дорожки {track_index} снято"
        logger.info(message)
        return {"status": "success", "message": message}

    def _emulate_select_track(self, track_type: str, track_index: int, fragment_index: Union[str, List[int], int]) -> Dict[str, Any]:
        """
        Эмулирует выполнение команды выделения дорожки или фрагмента
        """
        message = f"[ЭМУЛЯЦИЯ] Фрагмент {fragment_index} на {track_type} дорожке {track_index} выделен"
        logger.info(message)
        return {"status": "success", "message": message}


    def play_pause(self, action: str) -> Dict[str, Any]:
            """
            Управляет воспроизведением видео.

            Args:
                action: Действие для управления воспроизведением ('play' или 'pause')

            Returns:
                Результат выполнения команды
            """
            if not self.connected:
                return {"status": "error", "message": "Adobe Premiere Pro не подключен"}

            try:
                player = pymiere.objects.qe.project.getActiveSequence().player
                if action == "play":
                    player.play(1)  # Запускаем воспроизведение с нормальной скоростью
                    return {"status": "success", "message": "Воспроизведение запущено"}
                elif action == "pause":
                    player.stop()  # Останавливаем воспроизведение
                    return {"status": "success", "message": "Воспроизведение остановлено"}
                else:
                    return {"status": "error", "message": "Неверное действие. Используйте 'play' или 'pause'"}
            except Exception as e:
                logger.error(f"Ошибка при управлении воспроизведением: {str(e)}")
                return {"status": "error", "message": str(e)}

    def _emulate_cut_track(self, track_type: str, track_index: int, start_time: float, end_time: float) -> Dict[str, Any]:
        """
        Эмулирует выполнение команды обрезки дорожки
        """
        message = f"[ЭМУЛЯЦИЯ] Дорожка {track_type} {track_index} обрезана с {start_time} до {end_time} секунд"
        logger.info(message)
        return {"status": "success", "message": message}

    def get_tracks_info(self) -> Dict[str, Any]:
        """
        Получает информацию о видео и аудио дорожках в активной последовательности
        
        Returns:
            Информация о дорожках
        """
        if not self.connected:
            return {
                "status": "warning",
                "message": "Работа в режиме эмуляции",
                "video_tracks": [
                    {"index": 1, "name": "Video 1", "is_visible": True},
                    {"index": 2, "name": "Video 2", "is_visible": True}
                ],
                "audio_tracks": [
                    {"index": 1, "name": "Audio 1", "is_muted": False},
                    {"index": 2, "name": "Audio 2", "is_muted": False}
                ]
            }
        
        try:
            # Получаем активную последовательность
            sequence = self.project.activeSequence
            if not sequence:
                return {"status": "error", "message": "Нет активной последовательности"}
            
            tracks_info = {
                "status": "success",
                "sequence_name": sequence.name,
                "video_tracks": [],
                "audio_tracks": []
            }
            
            # Получаем информацию о видеодорожках
            for i in range(sequence.videoTracks.numTracks):
                track = sequence.videoTracks[i]
                is_visible = True
                try:
                    # Проверяем, видима ли дорожка
                    is_visible = track.isEnabled()
                except:
                    # Если метод isEnabled недоступен, предполагаем, что дорожка видима
                    pass
                
                track_info = {
                    "index": i + 1,  # Индекс для пользователя (начиная с 1)
                    "name": track.name,
                    "is_visible": is_visible
                }
                tracks_info["video_tracks"].append(track_info)
            
            # Получаем информацию о аудиодорожках
            for i in range(sequence.audioTracks.numTracks):
                track = sequence.audioTracks[i]
                is_muted = False
                try:
                    # Проверяем, заглушена ли дорожка
                    is_muted = track.isMuted()
                except:
                    # Если метод isMuted недоступен, предполагаем, что дорожка не заглушена
                    pass
                
                track_info = {
                    "index": i + 1,  # Индекс для пользователя (начиная с 1)
                    "name": track.name,
                    "is_muted": is_muted
                }
                tracks_info["audio_tracks"].append(track_info)
            
            return tracks_info
            
        except Exception as e:
            logger.error(f"Ошибка при получении информации о дорожках: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def _emulate_hide_video_track(self, track_index: int) -> Dict[str, Any]:
        """
        Эмулирует выполнение команды скрытия видеодорожки
        """
        message = f"[ЭМУЛЯЦИЯ] Видеодорожка {track_index} скрыта"
        logger.info(message)
        return {"status": "success", "message": message}
    
    def _emulate_show_video_track(self, track_index: int) -> Dict[str, Any]:
        """
        Эмулирует выполнение команды отображения видеодорожки
        """
        message = f"[ЭМУЛЯЦИЯ] Видеодорожка {track_index} показана"
        logger.info(message)
        return {"status": "success", "message": message}
    
    def _emulate_mute_audio_track(self, track_index: int) -> Dict[str, Any]:
        """
        Эмулирует выполнение команды заглушения аудиодорожки
        """
        message = f"[ЭМУЛЯЦИЯ] Аудиодорожка {track_index} заглушена"
        logger.info(message)
        return {"status": "success", "message": message}
    
    def _emulate_unmute_audio_track(self, track_index: int) -> Dict[str, Any]:
        """
        Эмулирует выполнение команды включения звука аудиодорожки
        """
        message = f"[ЭМУЛЯЦИЯ] Звук аудиодорожки {track_index} включен"
        logger.info(message)
        return {"status": "success", "message": message}

    def undo(self) -> Dict[str, Any]:
        """
        Отменяет последнее действие в Premiere Pro

        Returns:
            Результат выполнения команды
        """
        if not self.connected:
            return self._emulate_undo()
        
        try:
            # Включаем QE и выполняем команду отмены
            pymiere.objects.app.enableQE()
            pymiere.objects.qe.project.undo()
            
            return {
                "status": "success",
                "message": "Действие отменено"
            }
            
        except Exception as e:
            logger.error(f"Ошибка при отмене действия: {str(e)}")
            return {"status": "error", "message": str(e)}

    def _emulate_undo(self) -> Dict[str, Any]:
        """
        Эмулирует выполнение команды отмены действия
        """
        message = "[ЭМУЛЯЦИЯ] Действие отменено"
        logger.info(message)
        return {"status": "success", "message": message}


# Создаем экземпляр контроллера при импорте модуля
premiere = PremiereController()

def parse_time_to_seconds(time_str: str) -> float:
    """
    Преобразует строку времени в формате ЧЧ:ММ:СС в секунды.
    Если значение равно "-1", возвращает None.

    Args:
        time_str: Строка времени в формате ЧЧ:ММ:СС или "-1"

    Returns:
        Время в секундах или None, если time_str равно "-1"
    """
    if time_str == "-1":
        return None

    if not isinstance(time_str, str):
        raise ValueError("Временной параметр должен быть строкой в формате ЧЧ:ММ:СС или '-1'.")

    parts = time_str.split(':')
    if len(parts) != 3:
        raise ValueError("Неверный формат времени. Ожидается ЧЧ:ММ:СС.")

    hours, minutes, seconds = map(int, parts)
    return hours * 3600 + minutes * 60 + seconds


def hide_video_track(track_index: int) -> Dict[str, Any]:
    """
    Скрывает видеодорожку
    
    Args:
        track_index: Индекс видеодорожки (начиная с 1)
            
    Returns:
        Результат выполнения команды
    """
    return premiere.hide_video_track(track_index)

def show_video_track(track_index: int) -> Dict[str, Any]:
    """
    Показывает видеодорожку
    
    Args:
        track_index: Индекс видеодорожки (начиная с 1)
            
    Returns:
        Результат выполнения команды
    """
    return premiere.show_video_track(track_index)

def mute_audio_track(track_index: int) -> Dict[str, Any]:
    """
    Заглушает аудиодорожку
    
    Args:
        track_index: Индекс аудиодорожки (начиная с 1)
            
    Returns:
        Результат выполнения команды
    """
    return premiere.mute_audio_track(track_index)

def unmute_audio_track(track_index: int) -> Dict[str, Any]:
    """
    Включает звук аудиодорожки
    
    Args:
        track_index: Индекс аудиодорожки (начиная с 1)
            
    Returns:
        Результат выполнения команды
    """
    return premiere.unmute_audio_track(track_index)

def get_tracks_info() -> Dict[str, Any]:
    """
    Получает информацию о видео и аудио дорожках в активной последовательности
    
    Returns:
        Информация о дорожках
    """
    return premiere.get_tracks_info()

# Обновляем функцию process_commands для обработки новых команд
def process_commands(commands: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Обрабатывает список команд, полученных от API

    Args:
        commands: Список команд в формате JSON

    Returns:
        Результат выполнения команд
    """
    results = []

    if not isinstance(commands, list):
        return {"status": "error", "message": "Ожидался список команд"}

    for command_data in commands:
        if not isinstance(command_data, dict):
            results.append({"status": "error", "message": "Неверный формат команды"})
            continue

        command = command_data.get("command")
        parameters = command_data.get("parameters", {})

        # Преобразуем параметры track_index в число, если он существует
        if "track_index" in parameters:
            try:
                parameters["track_index"] = int(parameters["track_index"])
            except (ValueError, TypeError):
                logger.warning(f"Не удалось преобразовать track_index '{parameters['track_index']}' в число. Используется значение по умолчанию 1.")
                parameters["track_index"] = 1

        # Обработка fragment_index происходит в методе select_track

        if command == "mute_audio":
            track_index = parameters.get("track_index", 1)
            results.append(mute_audio_track(track_index))

        elif command == "unmute_audio":
            track_index = parameters.get("track_index", 1)
            results.append(unmute_audio_track(track_index))

        elif command == "hide_video":
            track_index = parameters.get("track_index", 1)
            results.append(hide_video_track(track_index))

        elif command == "show_video":
            track_index = parameters.get("track_index", 1)
            results.append(show_video_track(track_index))

        elif command == "hide_video_layer":
            track_index = parameters.get("track_index", 1)
            results.append(hide_video_track(track_index))

        elif command == "show_video_layer":
            track_index = parameters.get("track_index", 1)
            results.append(show_video_track(track_index))

        elif command == "select_track":
            track_type = parameters.get("track_type")
            track_index = parameters.get("track_index", 1)
            fragment_index = parameters.get("fragment_index", "all")
            results.append(premiere.select_track(track_type, track_index, fragment_index))

        elif command == "cut":
            track_type = parameters.get("track_type")
            track_index = parameters.get("track_index", 1)
            start_time_str = parameters.get("begin_time", "00:00:00")
            end_time_str = parameters.get("end_time", "-1")
            try:
                start_time = parse_time_to_seconds(start_time_str)
                end_time = parse_time_to_seconds(end_time_str)
            except ValueError as e:
                results.append({"status": "error", "message": str(e)})
                continue

            results.append(premiere.cut_track(track_type, track_index, start_time, end_time))

        elif command == "play_pause":
            action = parameters.get("action", "play")
            results.append(premiere.play_pause(action))

        elif command == "deselect_all_tracks":
            results.append(premiere.deselect_all_tracks())

        elif command == "deselect_track":
            track_type = parameters.get("track_type")
            track_index = parameters.get("track_index", None)
            results.append(premiere.deselect_track(track_type, track_index))

        elif command == "select_track_fragment":
            track_type = parameters.get("track_type")
            track_index = parameters.get("track_index", 1)
            fragment_index = parameters.get("fragment_index", "all")
            # Передаем fragment_index как есть, обработка массива происходит в методе select_track
            results.append(premiere.select_track(track_type, track_index, fragment_index))

        elif command == "deselect_track_fragments":
            track_type = parameters.get("track_type")
            track_index = parameters.get("track_index", None)
            fragment_index = parameters.get("fragment_index", None)
            results.append(premiere.deselect_track(track_type, track_index))

        elif command == "undo":
            results.append(premiere.undo())

        else:
            results.append({
                "status": "error",
                "message": f"Неизвестная команда: {command}"
            })

    return {
        "status": "success",
        "results": results
    }