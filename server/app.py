from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
from datetime import datetime
import glob
from pydub import AudioSegment
import speech_recognition as sr
from faster_whisper import WhisperModel
import threading
import time
import sqlite3
from contextlib import contextmanager
from huggingface_hub import hf_hub_download, scan_cache_dir, HfApi
from huggingface_hub.utils import HFCacheInfo
from pathlib import Path
import json
import psutil
import multiprocessing
from concurrent.futures import ThreadPoolExecutor
import platform
import tempfile
import shutil
from PyQt5.QtWidgets import QApplication, QFileDialog
import sys
import tkinter as tk

app = Flask(__name__)
CORS(app)

RECORDS_DIR = os.path.join(os.path.dirname(__file__), 'records')
if not os.path.exists(RECORDS_DIR):
    os.makedirs(RECORDS_DIR)

# Глобальные переменные для хранения моделей и их состояния
whisper_models = {}
system_status = {
    'initialized': False,
    'current_model': None,
    'initialization_progress': 0,
    'initialization_stage': ''
}

# Инициализация базы данных
DB_PATH = os.path.join(os.path.dirname(__file__), 'recordings.db')

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        # Таблица для записей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS recordings (
                filename TEXT PRIMARY KEY,
                transcription TEXT,
                timestamp TEXT,
                duration REAL,
                status TEXT DEFAULT 'completed'
            )
        ''')
        # Таблица для моделей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS installed_models (
                model_name TEXT PRIMARY KEY,
                model_type TEXT,
                installed_at TEXT
            )
        ''')
        conn.commit()

def migrate_db():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        # Проверяем, существует ли колонка status
        cursor.execute("PRAGMA table_info(recordings)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'status' not in columns:
            # Добавляем колонку status
            cursor.execute('''
                ALTER TABLE recordings 
                ADD COLUMN status TEXT DEFAULT 'completed'
            ''')
            conn.commit()
            print("Добавлена колонка status в таблицу recordings")

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
    finally:
        conn.close()

# Инициализируем БД при запуске
init_db()
migrate_db()

# Путь к кэшу Hugging Face
CACHE_DIR = Path.home() / '.cache' / 'huggingface'
MODELS_INFO_FILE = os.path.join(os.path.dirname(__file__), 'models_info.json')

def get_installed_whisper_models():
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT model_name FROM installed_models WHERE model_type = ?', ('whisper',))
            installed = cursor.fetchall()
            return [model[0] for model in installed]
    except Exception as e:
        print(f"Ошибка при получении списка установленных моделей: {str(e)}")
        return []

def mark_model_as_installed(model_name):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO installed_models (model_name, model_type, installed_at)
                VALUES (?, ?, ?)
            ''', (model_name, 'whisper', datetime.now().strftime('%Y-%m-%d %H:%M:%S')))
            conn.commit()
    except Exception as e:
        print(f"Ошибка при сохранении информации о модели: {str(e)}")

# Обновляем инициализацию моделей
def initialize_whisper_model(model_size):
    try:
        system_status['initialization_stage'] = f'Загрузка модели Whisper {model_size}'
        system_status['initialization_progress'] = 0
        
        # Проверяем, установлена ли уже модель
        installed_models = get_installed_whisper_models()
        
        if model_size not in installed_models:
            print(f"Загрузка новой модели {model_size}...")
            # Загружаем модель
            model = WhisperModel(model_size, device="cpu", compute_type="int8")
            # После успешной загрузки сохраняем инфомацию
            mark_model_as_installed(model_size)
        else:
            print(f"Использование установленной модели {model_size}")
            model = WhisperModel(model_size, device="cpu", compute_type="int8")
        
        whisper_models[model_size] = model
        system_status['current_model'] = model_size
        system_status['initialization_progress'] = 100
        
        print(f"Модель {model_size} успешно инициализирована")
        return True
    except Exception as e:
        print(f"Ошибка при загрузке Whisper модели: {str(e)}")
        return False

@app.route('/api/installed-models', methods=['GET'])
def get_installed_models():
    try:
        installed_models = get_installed_whisper_models()
        return jsonify({
            'success': True,
            'installed_models': installed_models
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/system-status', methods=['GET'])
def get_system_status():
    return jsonify(system_status)

@app.route('/api/initialize-models', methods=['POST'])
def initialize_models():
    try:
        data = request.json
        whisper_model_size = data.get('whisperModel', 'tiny')
        
        # Сброс статуса
        system_status['initialized'] = False
        system_status['initialization_progress'] = 0
        system_status['current_model'] = whisper_model_size
        
        # Инициализация Google Speech Recognition
        system_status['initialization_stage'] = 'Инициализация Google Speech Recognition'
        time.sleep(1)  # Имитация инициализации
        
        # Инициализация Whisper
        success = initialize_whisper_model(whisper_model_size)
        if not success:
            raise Exception("Ошибка инициализации Whisper")
        
        system_status['initialized'] = True
        return jsonify({
            'success': True,
            'message': 'Модели успешно инициализированы'
        })
        
    except Exception as e:
        print(f"Ошибка при инициализации: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def convert_webm_to_wav(webm_path):
    try:
        # Сздаем сооветствующий путь для WAV файла
        wav_filename = os.path.splitext(os.path.basename(webm_path))[0] + '.wav'
        wav_path = os.path.join(RECORDS_DIR, wav_filename)
        
        # Загружаем и конвертируем файл
        audio = AudioSegment.from_file(webm_path, format="webm")
        # Устанавливаем параметры для лучшего распознавания
        audio = audio.set_frame_rate(16000).set_channels(1)
        audio.export(wav_path, format="wav")
        
        return wav_path
    except Exception as e:
        print(f"Ошибка при конвертации в WAV: {str(e)}")
        return None

def recognize_speech(wav_path):
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data, language='ru-RU')
            return text
    except sr.UnknownValueError:
        print("Речь не распознана")
        return None
    except sr.RequestError as e:
        print(f"Ошибка сервиса распознавания: {str(e)}")
        return None
    except Exception as e:
        print(f"Ошибка при распознавании: {str(e)}")
        return None

# Создаем пул потоков для распознавания речи
speech_recognition_pool = ThreadPoolExecutor(
    max_workers=multiprocessing.cpu_count(),
    thread_name_prefix='speech_recognition'
)

def set_process_priority(high_priority=True):
    try:
        if platform.system() == 'Windows':
            import psutil
            process = psutil.Process()
            if high_priority:
                process.nice(psutil.HIGH_PRIORITY_CLASS)
            else:
                process.nice(psutil.NORMAL_PRIORITY_CLASS)
        else:  # Unix-системы
            import os
            if high_priority:
                os.nice(-20)
            else:
                os.nice(0)
    except Exception as e:
        print(f"Не удалось изменить приоритет процесса: {str(e)}")

def recognize_with_whisper(audio_path):
    try:
        if not system_status['current_model'] or not whisper_models.get(system_status['current_model']):
            raise Exception("Модель Whisper не инициализирована")
            
        model = whisper_models[system_status['current_model']]
        # Устанавливаем высокий приоритет л процесса расознавания
        set_process_priority(True)
        
        segments, info = model.transcribe(
            audio_path, 
            language="ru",
            beam_size=5,
            best_of=5,
            temperature=0.0
        )
        return " ".join([segment.text for segment in segments])
    except Exception as e:
        print(f"Ошибка при распознавании Whisper: {str(e)}")
        return None
    finally:
        # Возвращаем нормальный приоритет
        set_process_priority(False)

def recognize_with_google(wav_path):
    recognizer = sr.Recognizer()
    try:
        # Оптимизируем настройки распознавания
        recognizer.energy_threshold = 300
        recognizer.dynamic_energy_threshold = False
        recognizer.pause_threshold = 0.5
        
        with sr.AudioFile(wav_path) as source:
            # Устанавливаем высокий приоритет
            set_process_priority(True)
            
            audio_data = recognizer.record(source)
            return recognizer.recognize_google(
                audio_data, 
                language='ru-RU',
                show_all=False
            )
    except Exception as e:
        print(f"Ошибка при распознавании Google: {str(e)}")
        return None
    finally:
        # Возвращаем нормальный приоритет
        set_process_priority(False)

@app.route('/api/process-audio', methods=['POST'])
def process_audio_route():
    if 'audio' not in request.files:
        return jsonify({
            "success": False,
            "error": "Аудио файл не найден"
        }), 400
    
    try:
        audio_file = request.files['audio']
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        wav_filename = f'recording_{timestamp}.wav'
        wav_path = os.path.join(RECORDS_DIR, wav_filename)
        
        # Быстрое распознавание в памяти
        audio = AudioSegment.from_file(audio_file, format="webm")
        audio = audio.set_frame_rate(16000).set_channels(1)
        duration = len(audio) / 1000.0

        # Сразу сохраняем файл в основную директорию
        audio.export(wav_path, format="wav")
        
        # Получаем метод распознавания из параметров запроса
        recognition_method = request.args.get('method', 'whisper')
        print(f"\n=== Распознавание речи ===")
        print(f"Полученный метод: {recognition_method}")
        print(f"Файл: {wav_filename}")
        
        initial_text = None
        
        # Проверяем метод распознавания
        if recognition_method == 'google':
            print("Запуск Google Speech Recognition")
            initial_text = recognize_with_google(wav_path)
            if initial_text is None:
                raise Exception("Ошибка распонавания Google Speech")
        else:
            print(f"Запуск Whisper (модель: {system_status['current_model']})")
            initial_text = recognize_with_whisper(wav_path)
            if initial_text is None:
                raise Exception("Ошибка распознавания Whisper")

        print(f"Результат распознавания: {initial_text[:100] if initial_text else 'Нет результата'}...")

        try:
            # Сохраняем в БД
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO recordings (filename, transcription, timestamp, duration, status)
                    VALUES (?, ?, ?, ?, ?)
                ''', (wav_filename, initial_text or "Идет распознавание...", 
                      datetime.now().strftime('%Y-%m-%d %H:%M:%S'), 
                      duration, 'completed'))
                conn.commit()
        except sqlite3.IntegrityError as e:
            print(f"Ошибка при сохранении в БД: {str(e)}")
            # Если запись уже существует, обновляем её
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE recordings 
                    SET transcription = ?, timestamp = ?, duration = ?, status = ?
                    WHERE filename = ?
                ''', (initial_text or "Идет распознавание...", 
                      datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                      duration, 'completed', wav_filename))
                conn.commit()

        return jsonify({
            "success": True,
            "filename": wav_filename,
            "text": initial_text or "Идет распознавание...",
            "duration": duration,
            "status": "completed"
        })
            
    except Exception as e:
        print(f"Ошибка при обработке аудио: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Ошибка при обработке аудио",
            "details": str(e)
        }), 500

# Добавляем новый маршрут для проверки статуса распознавания
@app.route('/api/recordings/status/<filename>', methods=['GET'])
def get_recording_status(filename):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT transcription, status
                FROM recordings 
                WHERE filename = ?
            ''', (filename,))
            result = cursor.fetchone()
            
            if result:
                transcription, status = result
                return jsonify({
                    "success": True,
                    "transcription": transcription,
                    "status": status
                })
            return jsonify({"error": "Запись не найдена"}), 404
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/recordings', methods=['GET'])
def get_recordings():
    try:
        files = glob.glob(os.path.join(RECORDS_DIR, '*.wav'))
        recordings = []
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            for file in files:
                filename = os.path.basename(file)
                # Получаем информацию из БД
                cursor.execute('SELECT transcription, timestamp, duration FROM recordings WHERE filename = ?', 
                             (filename,))
                db_record = cursor.fetchone()
                
                if db_record:
                    transcription, timestamp, duration = db_record
                else:
                    # Если записи нет в БД, создаем новую
                    timestamp = datetime.fromtimestamp(os.path.getctime(file)).strftime('%Y-%m-%d %H:%M:%S')
                    duration = len(AudioSegment.from_file(file)) / 1000.0
                    transcription = None
                    
                    cursor.execute('''
                        INSERT INTO recordings (filename, transcription, timestamp, duration)
                        VALUES (?, ?, ?, ?)
                    ''', (filename, transcription, timestamp, duration))
                    conn.commit()
                
                recordings.append({
                    'filename': filename,
                    'timestamp': timestamp,
                    'duration': duration,
                    'transcription': transcription,
                    'path': file
                })
        
        recordings.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify({
            'recordings': recordings,
            'total': len(recordings)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/recordings/<filename>', methods=['DELETE'])
def delete_recording(filename):
    try:
        file_path = os.path.join(RECORDS_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            
            # Удаляем запись из БД
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM recordings WHERE filename = ?', (filename,))
                conn.commit()
                
            return jsonify({'success': True})
        return jsonify({'error': 'Файл не найден'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/recordings/play/<filename>')
def play_recording(filename):
    try:
        file_path = os.path.join(RECORDS_DIR, filename)
        if not os.path.exists(file_path):
            return jsonify({'error': 'Файл не найден'}), 404
            
        return send_file(
            file_path,
            mimetype='audio/wav',  # Изменяем MIME-тип на WAV
            as_attachment=False
        )
    except Exception as e:
        print(f"Ошибка при воспроизведении {filename}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/recordings/latest', methods=['GET'])
def get_latest_recording():
    try:
        files = glob.glob(os.path.join(RECORDS_DIR, '*.wav'))
        if not files:
            return jsonify({
                "exists": False,
                "message": "Отсутствуют аудиозаписи для проигрывания"
            }), 404
            
        latest_file = max(files, key=os.path.getctime)
        filename = os.path.basename(latest_file)
        
        if not os.path.exists(latest_file):
            return jsonify({
                "exists": False,
                "message": "Файл не найден"
            }), 404
            
        return jsonify({
            "exists": True,
            "filename": filename,
            "path": latest_file
        })
    except Exception as e:
        print(f"Ошибка при получении последней записи: {str(e)}")
        return jsonify({
            "exists": False,
            "error": str(e),
            "message": "Ошибка при получении записи"
        }), 500

@app.route('/api/recordings/clear', methods=['DELETE'])
def clear_recordings():
    try:
        pattern = os.path.join(RECORDS_DIR, '**', '*.wav')
        files = glob.glob(pattern, recursive=True)
        
        if not files:
            return jsonify({'success': True, 'message': 'Нет файлов для удаления'})
        
        deleted_count = 0
        failed_files = []
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            for file in files:
                try:
                    os.remove(file)
                    filename = os.path.basename(file)
                    cursor.execute('DELETE FROM recordings WHERE filename = ?', (filename,))
                    deleted_count += 1
                    print(f"Удален файл: {file}")
                except Exception as e:
                    failed_files.append({"file": file, "error": str(e)})
                    print(f"Ошибка при удалении {file}: {str(e)}")
            
            conn.commit()
        
        result = {
            'success': True,
            'message': f'Удалено айлов: {deleted_count}',
            'total_found': len(files)
        }
        
        if failed_files:
            result['failed_files'] = failed_files
            
        return jsonify(result)
        
    except Exception as e:
        print(f"Общая ошибка при очистке: {str(e)}")
        return jsonify({
            'error': str(e),
            'message': 'Ошибка при очистке заисей'
        }), 500

def get_nodejs_memory():
    try:
        nodejs_processes = []
        for proc in psutil.process_iter(['pid', 'name', 'memory_info']):
            if 'node' in proc.info['name'].lower():
                nodejs_processes.append(proc)
        
        if nodejs_processes:
            # Суммируем память всех процессов Node.js
            total_memory = sum(proc.info['memory_info'].rss for proc in nodejs_processes)
            return total_memory
        return 0
    except Exception as e:
        print(f"Ошибка при получении памяти Node.js: {str(e)}")
        return 0

def get_python_memory():
    try:
        # Получаем текущий процесс Python
        current_process = psutil.Process(os.getpid())
        python_memory = current_process.memory_info().rss
        return python_memory
    except Exception as e:
        print(f"Ошибка при получении памяти Python: {str(e)}")
        return 0

@app.route('/api/memory-usage', methods=['GET'])
def get_memory_usage():
    try:
        # Получаем память Node.js процесса (клиент)
        nodejs_memory = get_nodejs_memory()
        
        # Получаем память Python процесса (сервер)
        python_memory = get_python_memory()
        
        # Получаем информацию о системной памяти
        system_memory = psutil.virtual_memory()
        
        # Общая память приложения в байтах
        app_total_memory = nodejs_memory + python_memory
        
        # Свободная память системы в байтах
        free_memory = system_memory.available
        
        # Конвертируем в гигабайты
        app_total_gb = app_total_memory / (1024 ** 3)
        free_gb = free_memory / (1024 ** 3)
        
        # Вычисляем процент использования относительно свободной памяти
        usage_percent = (app_total_gb / (app_total_gb + free_gb)) * 100 if free_gb > 0 else 100
        
        return jsonify({
            'success': True,
            'total': round(app_total_gb + free_gb, 1),  # Сумма памяти приложения и свободной памяти
            'used': round(app_total_gb, 2),             # Память, используемая приложением
            'free': round(free_gb, 2),                  # Свободная память
            'percent': round(usage_percent, 1),         # Процент использования
            'details': {
                'nodejs': round(nodejs_memory / (1024 * 1024 * 1024), 2),
                'python': round(python_memory / (1024 * 1024 * 1024), 2)
            }
        })
    except Exception as e:
        print(f"Ошибка при получении информации о памяти: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health-check', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'message': 'Server is running'
    })

@app.route('/api/cancel-initialization', methods=['POST'])
def cancel_initialization():
    try:
        # Сбрасываем статус системы
        system_status['initialized'] = False
        system_status['current_model'] = None
        system_status['initialization_progress'] = 0
        system_status['initialization_stage'] = ''
        
        # Очищаем загруженные модели
        whisper_models.clear()
        
        return jsonify({
            'success': True,
            'message': 'Инициализация отменена'
        })
        
    except Exception as e:
        print(f"Ошибка при отмене инициализации: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models-info', methods=['GET'])
def get_models_info():
    try:
        # Загружаем путь из конфигурации
        try:
            with open('config.json', 'r', encoding='utf-8') as f:
                config = json.load(f)
                models_path = config.get('models_path')
        except:
            models_path = str(Path.home() / '.cache' / 'huggingface' / 'hub')
        
        # Получаем размеры установленных моделей
        model_sizes = {}
        installed_models = {}
        
        for model_id in ['tiny', 'base', 'small', 'medium']:
            model_path = Path(models_path) / f'models--Systran--faster-whisper-{model_id}'
            if model_path.exists():
                # Получаем размер директории
                size = sum(f.stat().st_size for f in model_path.rglob('*') if f.is_file())
                # Конвертируем в ГБ
                model_sizes[model_id] = f"{size / (1024**3):.2f} ГБ"
                installed_models[model_id] = True
            else:
                installed_models[model_id] = False
        
        return jsonify({
            'success': True,
            'models_path': models_path,
            'model_sizes': model_sizes,
            'installed_models': installed_models
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/clear-models', methods=['POST'])
def clear_models():
    try:
        cache_dir = Path.home() / '.cache' / 'huggingface' / 'hub'
        
        # Удаляем все директории с моделями whisper
        for model_dir in cache_dir.glob('models--Systran--faster-whisper-*'):
            shutil.rmtree(model_dir)
        
        # Очищаем .locks директорию
        locks_dir = cache_dir / '.locks'
        if locks_dir.exists():
            shutil.rmtree(locks_dir)
            locks_dir.mkdir()
        
        return jsonify({
            'success': True,
            'message': 'Все модели успешно удалены'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/select-models-path', methods=['POST'])
def select_models_path():
    return jsonify({
        'success': False,
        'message': 'Функция будет доступна в следующей версии'
    })

if __name__ == '__main__':
    # Запускаем Flask-сервер
    app.run(debug=True, port=5000)