import eel
import sys
import os
import ctypes
import json
import requests
from datetime import datetime, timedelta
import time

# Импортируем наш модуль для работы с Premiere Pro
try:
    import premiere_controller
    PREMIERE_AVAILABLE = True
except ImportError:
    PREMIERE_AVAILABLE = False
    print("Не удалось импортировать модуль premiere_controller. Команды не будут выполняться в Premiere Pro.")

# Инициализация Eel с указанием пути к веб-файлам
eel.init('web')

# Получаем размеры экрана (для Windows)
user32 = ctypes.windll.user32
screen_width = user32.GetSystemMetrics(0)
screen_height = user32.GetSystemMetrics(1)

# Размеры окна приложения
window_width = 400
window_height = 300

# Вычисляем позицию для центрирования
position_x = (screen_width - window_width) // 2
position_y = (screen_height - window_height) // 2

# Функция для обработки команд
@eel.expose
def send_command(command_data):
    """
    Обрабатывает команду с метаданными, полученную из JavaScript
    
    Параметры:
    command_data (dict): Словарь с данными о команде
        - start_time: время начала записи команды (timestamp)
        - end_time: время окончания записи команды (timestamp)
        - duration_ms: общая длительность записи команды в миллисекундах
        - pause_duration_ms: длительность паузы в миллисекундах
        - duration_without_pause_ms: длительность записи без учета паузы
        - recognition_type: тип распознавания ('continuous' или 'simple')
        - text: текст распознанной команды
    """
    try:
        # Проверяем наличие всех необходимых полей
        required_fields = ['start_time', 'end_time', 'text', 'recognition_type']
        for field in required_fields:
            if field not in command_data:
                raise ValueError(f"Отсутствует обязательное поле: {field}")
        
        # Преобразуем timestamp в читаемый формат
        start_time_str = datetime.fromtimestamp(command_data['start_time'] / 1000).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        end_time_str = datetime.fromtimestamp(command_data['end_time'] / 1000).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        
        # Получаем дополнительные параметры или устанавливаем значения по умолчанию
        pause_duration_ms = command_data.get('pause_duration_ms', 0)
        duration_without_pause_ms = command_data.get('duration_without_pause_ms', command_data['duration_ms'])
        # Выводим информацию о команде
        print("\n=== ПОЛУЧЕНА КОМАНДА ===")
        print(f"Текст: {command_data['text']}")
        print(f"Тип распознавания: {command_data['recognition_type']}")
        print(f"Время начала: {start_time_str}")
        print(f"Время окончания: {end_time_str}")
        print(f"Общая длительность: {command_data['duration_ms']} мс")
        print(f"Длительность паузы: {pause_duration_ms} мс")
        print(f"Чистая длительность (без паузы): {duration_without_pause_ms} мс")
        
        # Замеряем время начала обработки API
        api_start_time = datetime.now()
        
        # Отправляем команду на API и измеряем время обработки
        api_result = send_to_api(command_data['text'])
        
        # Замеряем время окончания обработки API
        api_end_time = datetime.now()
        api_processing_time = api_end_time - api_start_time
        api_processing_ms = int(api_processing_time.total_seconds() * 1000)
        
        print(f"Время обработки API: {api_processing_ms} мс")
        print("========================\n")
        
        # Возвращаем результат с дополнительной информацией
        return {
            "status": "success", 
            "message": "Команда успешно получена и обработана",
            "command_data": command_data,
            "api_result": api_result,
            "formatted_data": {
                "start_time": start_time_str,
                "end_time": end_time_str,
                "duration_ms": command_data['duration_ms'],
                "pause_duration_ms": pause_duration_ms,
                "duration_without_pause_ms": duration_without_pause_ms,
                "api_processing_ms": api_processing_ms
            }
        }
    except Exception as e:
        error_message = f"Ошибка при обработке команды: {str(e)}"
        print(error_message)
        return {
            "status": "error",
            "message": error_message
        }

def send_to_api(text):
    """
    Отправляет текст команды на API и возвращает результат
    
    Параметры:
    text (str): Текст команды для отправки
    
    Возвращает:
    dict: Результат обработки API и время обработки
    """
    try:
        # Фиксируем время начала обработки
        processing_start_time = datetime.now()
        
        # Формируем данные для запроса
        api_url = "http://localhost:5000/api/generate"
        payload = {
            "prompt": text,
            "model": "gemini-2.0-flash"
        }
        
        print(f"Отправка запроса на API: {api_url}")
        print(f"Данные запроса: {payload}")
        
        # Отправляем POST-запрос
        response = requests.post(api_url, json=payload)
        
        # Фиксируем время окончания обработки API
        api_end_time = datetime.now()
        
        # Вычисляем время обработки API
        api_processing_time = api_end_time - processing_start_time
        api_processing_seconds = api_processing_time.total_seconds()
        
        # Форматируем время обработки API в часы:минуты:секунды
        hours, remainder = divmod(api_processing_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        api_formatted_time = f"{int(hours):02}:{int(minutes):02}:{seconds:.3f}"
        
        # Выводим информацию о результате обработки API
        print(f"Результат обработки API: {response.status_code}")
        
        # Пытаемся получить JSON из ответа и форматируем его
        try:
            api_response = response.json()
            
            # Выводим prompt и response в читаемом виде
            print(f"Запрос: {api_response.get('prompt', '')}")
            
            # Если response - это строка JSON, преобразуем ее в объект для форматирования
            response_text = api_response.get('response', '')
            if isinstance(response_text, str):
                try:
                    # Пытаемся распарсить JSON из строки
                    response_obj = json.loads(response_text)
                    
                    # Проверяем наличие ключа "command" в каждом объекте
                    if isinstance(response_obj, list):
                        for i, item in enumerate(response_obj):
                            if isinstance(item, dict) and 'command' not in item:
                                print(f"ПРЕДУПРЕЖДЕНИЕ: Отсутствует ключ 'command' в объекте {i+1}")
                    
                    # Форматируем JSON с отступами для лучшей читаемости
                    formatted_response = json.dumps(response_obj, indent=2, ensure_ascii=False)
                    print(f"Ответ API:\n{formatted_response}")
                    
                    # Обновляем response в api_response
                    api_response['response'] = formatted_response
                    
                    # Выполняем команды в Premiere Pro, если доступно
                    if PREMIERE_AVAILABLE:
                        # Фиксируем время начала выполнения команд
                        premiere_start_time = datetime.now()
                        
                        # Выполняем команды
                        premiere_result = premiere_controller.process_commands(response_obj)
                        
                        # Фиксируем время окончания выполнения команд
                        premiere_end_time = datetime.now()
                        
                        # Вычисляем время выполнения команд
                        premiere_processing_time = premiere_end_time - premiere_start_time
                        premiere_processing_seconds = premiere_processing_time.total_seconds()
                        
                        # Форматируем время выполнения команд в часы:минуты:секунды
                        hours, remainder = divmod(premiere_processing_seconds, 3600)
                        minutes, seconds = divmod(remainder, 60)
                        premiere_formatted_time = f"{int(hours):02}:{int(minutes):02}:{seconds:.3f}"
                        
                        # Выводим результат выполнения команд
                        print(f"Результат выполнения команд в Premiere Pro:")
                        print(json.dumps(premiere_result, indent=2, ensure_ascii=False))
                        print(f"Время выполнения команд: {premiere_formatted_time} (ч:м:с)")
                        
                        # Добавляем результат выполнения команд в ответ
                        api_response['premiere_result'] = premiere_result
                        api_response['premiere_processing_time'] = premiere_formatted_time
                    
                except json.JSONDecodeError:
                    # Если не удалось распарсить JSON, выводим как есть
                    print(f"Ответ API:\n{response_text}")
            else:
                # Если response не строка, форматируем весь объект
                print(f"Ответ API:\n{json.dumps(response_text, indent=2, ensure_ascii=False)}")
        except Exception as e:
            print(f"Ошибка при обработке ответа API: {str(e)}")
            api_response = {"error": "Не удалось получить JSON из ответа"}
        
        # Фиксируем время окончания всей обработки
        processing_end_time = datetime.now()
        
        # Вычисляем общее время обработки
        processing_time = processing_end_time - processing_start_time
        processing_seconds = processing_time.total_seconds()
        
        # Форматируем общее время обработки в часы:минуты:секунды
        hours, remainder = divmod(processing_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        formatted_time = f"{int(hours):02}:{int(minutes):02}:{seconds:.3f}"
        
        print(f"Общее время обработки: {formatted_time} (ч:м:с)")
        
        return {
            "status": response.status_code,
            "processing_time": formatted_time,
            "processing_seconds": processing_seconds,
            "api_processing_time": api_formatted_time,
            "api_processing_seconds": api_processing_seconds,
            "response": api_response
        }
    except Exception as e:
        error_message = f"Ошибка при отправке запроса на API: {str(e)}"
        print(error_message)
        return {
            "status": "error",
            "message": error_message,
            "processing_time": "00:00:00.000"
        }

# Функции для управления окном
@eel.expose
def minimize_window():
    # В Eel нет прямого доступа к окну, поэтому используем JavaScript
    eel.minimize_window_js()()

@eel.expose
def close_window():
    sys.exit()

# Запуск приложения
if __name__ == '__main__':
    try:
        # Пытаемся запустить Chrome в режиме приложения с фиксированным портом
        eel.start(
            'index.html',
            size=(window_width, window_height),
            position=(position_x, position_y),
            port=60700,  # Фиксированный порт
            mode='chrome',
            cmdline_args=[
                '--disable-infobars',
                '--disable-notifications',
                '--no-default-browser-check',
                '--disable-features=TranslateUI',
                '--disable-plugins',
                '--disable-extensions',
                '--app-window-size=400,270',
                '--window-size=400,270',
                '--frameless',
                '--enable-features=OverlayScrollbar,Panels',
                '--enable-panels',
                '--panel-mode',
                '--disable-frame-rate-limit',
                '--disable-gpu-vsync',
                '--force-dark-mode',
                '--hide-scrollbars',
                '--disable-features=RendererCodeIntegrity',
                '--window-css=* { cursor: default !important; }',
                '--override-content-security-policy',
                '--app-shell-host-window-size=400x270',
                '--app-shell-always-on-top',
                '--chrome-frame=false',
                '--enable-precise-memory-info',
                '--disable-top-sites',
                '--disable-popup-blocking',
                '--disable-sync',
                '--noerrdialogs',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-translate',
                '--disable-default-apps',
                '--disable-component-update',
                '--overscroll-history-navigation=0',
                '--autoplay-policy=no-user-gesture-required',
                '--title-bar-style=hidden',
                '--app-shell-force-dark',
                '--panel',
            ]
        )
    except Exception as e:
        # Если порт занят, пробуем закрыть существующий процесс
        if "Port 60700 is already in use" in str(e):
            import psutil
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info['cmdline']
                    if cmdline and any('--port=60700' in arg for arg in cmdline):
                        proc.kill()
                        # Пробуем запустить приложение снова после небольшой паузы
                        time.sleep(1)
                        eel.start(
                            'index.html',
                            size=(window_width, window_height),
                            position=(position_x, position_y),
                            port=60700,
                            mode='chrome',
                            cmdline_args=[
                                '--disable-infobars',
                                '--disable-notifications',
                                '--no-default-browser-check',
                                '--disable-features=TranslateUI',
                                '--disable-plugins',
                                '--disable-extensions',
                                '--app-window-size=400,270',
                                '--window-size=400,270',
                                '--frameless',
                                '--enable-features=OverlayScrollbar,Panels',
                                '--enable-panels',
                                '--panel-mode',
                                '--disable-frame-rate-limit',
                                '--disable-gpu-vsync',
                                '--force-dark-mode',
                                '--hide-scrollbars',
                                '--disable-features=RendererCodeIntegrity',
                                '--window-css=* { cursor: default !important; }',
                                '--override-content-security-policy',
                                '--app-shell-host-window-size=400x270',
                                '--app-shell-always-on-top',
                                '--chrome-frame=false',
                                '--enable-precise-memory-info',
                                '--disable-top-sites',
                                '--disable-popup-blocking',
                                '--disable-sync',
                                '--noerrdialogs',
                                '--no-first-run',
                                '--no-default-browser-check',
                                '--disable-translate',
                                '--disable-default-apps',
                                '--disable-component-update',
                                '--overscroll-history-navigation=0',
                                '--autoplay-policy=no-user-gesture-required',
                                '--title-bar-style=hidden',
                                '--app-shell-force-dark',
                                '--panel',
                            ]
                        )
                        break
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        print(f"Не удалось запустить приложение: {e}") 