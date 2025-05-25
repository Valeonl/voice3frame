from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os
import google.generativeai as genai
from dotenv import load_dotenv
import time
import json
import requests
# Определение режима работы API
USE_HTTP_API = False  # True для использования HTTP API, False для использования библиотеки

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type"],
    "max_age": 3600
}})

# Конфигурация Google Gemini
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
model = genai.GenerativeModel('gemini-2.0-flash')  

def read_prompt(prompt_file='prompts/base.md'):
    """
    Читает промпт из файла или генерирует из config.json
    """
    config_path = 'prompts/config.json'
    
    # Проверяем наличие config.json
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                
            # Если в конфигурации есть готовый промпт, используем его
            if 'promptText' in config:
                print(f"Используем promptText из config.json")
                return config['promptText']
                
            # Иначе генерируем промпт из конфигурации
            print(f"Генерируем промпт из конфигурации")
            return generate_prompt_from_config(config)
        except Exception as e:
            print(f"Ошибка при чтении config.json: {str(e)}")
    
    # Если config.json не существует или произошла ошибка, читаем из файла
    try:
        print(f"Читаем промпт из файла {prompt_file}")
        with open(prompt_file, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Ошибка при чтении промпта из файла {prompt_file}: {str(e)}")
        return "Ты - система распознавания команд. Анализируйте входящий текст и определяйте, какая команда выполняется."

def generate_prompt_from_config(config):
    """
    Генерирует текст промпта из конфигурации
    """
    # # Если в конфигурации уже есть готовый промпт, используем его
    # if 'promptText' in config:
    #     return config['promptText']
    
    # Иначе генерируем промпт из конфигурации
    role = config.get('role', "Ты - система распознавания команд. Анализируйте входящий текст и определяйте, какая команда выполняется.")
    commands = config.get('commands', [])
    
    prompt_text = f"{role}\n\nДоступные команды:\n"
    
    for i, cmd in enumerate(commands):
        prompt_text += f"{i + 1}. {cmd['className']} - {cmd['description']}\n"
        
        if 'examples' in cmd and cmd['examples']:
            prompt_text += "   Примеры:\n"
            for example in cmd['examples']:
                prompt_text += f"   - \"{example}\"\n"
        
        if 'parameters' in cmd and cmd['parameters']:
            prompt_text += "   Параметры:\n"
            for param in cmd['parameters']:
                param_desc = f"     - {param['name']}: {param['description']}"
                
                if 'defaultValue' in param and param['defaultValue']:
                    param_desc += f" (по умолчанию: \"{param['defaultValue']}\")"
                
                prompt_text += param_desc + "\n"
                
                if 'possibleValues' in param and param['possibleValues']:
                    values_str = ", ".join(param['possibleValues'])
                    prompt_text += f"       Возможные значения: [{values_str}]\n"
        
        prompt_text += "\n"
    
    # Добавляем формат ответа
    prompt_text += """
Формат ответа:
[
{
    "command": "название_команды 1",
    "confidence": 0.95,
    "parameters": {}
},
{
    "command": "название_команды 2",
    "confidence": 0.91,
    "parameters": {}
}
]"""
    
    return prompt_text

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/generate', methods=['POST'])
def generate():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        user_input = data.get('prompt', data.get('text', ''))
        model_name = data.get('model', 'gemini-1.5-flash')
        
        if not user_input:
            return jsonify({'error': 'No prompt/text provided'}), 400
            
        # Получаем промпт из config.json, если он существует
        config_path = 'prompts/config.json'
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                
                if 'promptText' in config:
                    prompt_template = config['promptText']
                    print(f"Используем промпт из config.json")
                else:
                    prompt_template = generate_prompt_from_config(config)
                    print(f"Генерируем промпт из конфигурации")
            except Exception as e:
                print(f"Ошибка при чтении config.json: {str(e)}")
                prompt_template = read_prompt()
        else:
            prompt_template = read_prompt()
            
        full_prompt = f"{prompt_template}\n\n{user_input}"
        print(full_prompt)
        
        print(f"Full prompt length: {len(full_prompt)} characters")
        try:
            print(f"Sending request to Gemini API with prompt: {user_input[:100]}...")
            if USE_HTTP_API:
                # Подготовка текста для вставки в JSON структуру
                escaped_prompt = full_prompt.replace('"', "'")
                
                # Используем HTTP POST запрос
                payload = {
                    "api_key": "AIzaSyCHf9WQ3s9icfZodZgrlCGXDJYKecAnhII",
                    "model": "gemini-2.0-flash",
                    "msg": escaped_prompt
                }
                response = requests.post(
                    'https://valeonl2025test.app.n8n.cloud/webhook/gemii_api',
                    json=payload
                )
                print(f"Response from HTTP API: {response}")
            else:
                # Используем генерацию через библиотеку
                response = model.generate_content(
                    full_prompt,
                    generation_config={
                        'temperature': 0.5,
                        'top_p': 1,
                        'top_k': 1,
                        'max_output_tokens': 2048,
                    }
                )
            
            if response.text:
                print("Received response from Gemini API")
                # Очищаем ответ от маркеров форматирования
                clean_response = response.text.replace('```json\n', '').replace('\n```', '').strip()
                print(clean_response)
                return jsonify({
                    'response': clean_response,
                    'prompt': user_input
                })
            else:
                print("Empty response from Gemini API")
                return jsonify({'error': 'Empty response from model'}), 500
                
        except Exception as e:
            print(f"Gemini API error: {type(e).__name__}: {str(e)}")
            return jsonify({'error': str(e)}), 500
            
    except Exception as e:
        print(f"Server error: {type(e).__name__}: {str(e)}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/prompt', methods=['GET', 'POST'])
def handle_prompt():
    try:
        config_path = 'prompts/config.json'
        custom_prompt_path = 'prompts/custom.md'
        base_prompt_path = 'prompts/base.md'
        
        if request.method == 'GET':
            # Проверяем наличие config.json
            if os.path.exists(config_path):
                try:
                    with open(config_path, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                    
                    # Используем promptText из конфигурации, если он есть
                    if 'promptText' in config:
                        prompt_text = config['promptText']
                    else:
                        # Иначе генерируем промпт из конфигурации
                        prompt_text = generate_prompt_from_config(config)
                        # Обновляем конфигурацию с новым промптом
                        config['promptText'] = prompt_text
                        
                        # Сохраняем обновленную конфигурацию
                        with open(config_path, 'w', encoding='utf-8') as f:
                            json.dump(config, f, ensure_ascii=False, indent=2)
                    
                    print(f"Возвращаем промпт из config.json")
                    return jsonify({
                        'prompt': prompt_text,
                        'isCustom': True,
                        'config': config
                    })
                except Exception as e:
                    print(f"Ошибка при чтении config.json: {str(e)}")
                    return jsonify({'error': f'Ошибка при чтении config.json: {str(e)}'}), 500
            
            # Если config.json не существует, проверяем наличие custom.md
            if os.path.exists(custom_prompt_path):
                with open(custom_prompt_path, 'r', encoding='utf-8') as f:
                    custom_prompt = f.read()
                return jsonify({
                    'prompt': custom_prompt,
                    'isCustom': True,
                    'basePrompt': read_prompt(base_prompt_path) if os.path.exists(base_prompt_path) else ''
                })
            
            # Иначе возвращаем базовый промпт
            if not os.path.exists(base_prompt_path):
                return jsonify({'error': 'Базовый промпт не найден'}), 404
                
            return jsonify({
                'prompt': read_prompt(base_prompt_path),
                'isCustom': False,
                'basePrompt': ''
            })
        else:  # POST
            data = request.json
            if not data:
                return jsonify({'error': 'Данные не предоставлены'}), 400
            
            # Создаем директории, если они не существуют
            os.makedirs('prompts', exist_ok=True)
            
            # Если есть конфигурация - сохраняем её
            if 'config' in data:
                config = data['config']
                
                # Убедимся, что в конфигурации есть promptText
                if 'promptText' not in config:
                    config['promptText'] = generate_prompt_from_config(config)
                
                # Сохраняем конфигурацию
                with open(config_path, 'w', encoding='utf-8') as f:
                    json.dump(config, f, ensure_ascii=False, indent=2)
                
                # Также сохраняем текстовый промпт в custom.md для совместимости
                with open(custom_prompt_path, 'w', encoding='utf-8') as f:
                    f.write(config['promptText'])
                
                print(f"Сохранена конфигурация с промптом: {config['promptText'][:50]}...")
                return jsonify({
                    'status': 'success', 
                    'message': 'Конфигурация успешно обновлена',
                    'isCustom': True
                })
            
            # Если есть только текстовый промпт - сохраняем его
            elif 'prompt' in data:
                prompt_text = data.get('prompt', '')
                is_custom = data.get('isCustom', True)
                
                # Определяем, какой файл обновлять
                file_path = 'prompts/base.md' if not is_custom else 'prompts/custom.md'
                
                try:
                    # Сохраняем текстовый промпт
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(prompt_text)
                    
                    # Если есть config.json, обновляем и его
                    if os.path.exists(config_path) and is_custom:
                        try:
                            with open(config_path, 'r', encoding='utf-8') as f:
                                config = json.load(f)
                            
                            config['promptText'] = prompt_text
                            
                            with open(config_path, 'w', encoding='utf-8') as f:
                                json.dump(config, f, ensure_ascii=False, indent=2)
                        except Exception as e:
                            print(f"Ошибка при обновлении config.json: {str(e)}")
                    
                    return jsonify({
                        'status': 'success', 
                        'message': 'Промпт успешно обновлен',
                        'isCustom': is_custom
                    })
                except Exception as e:
                    print(f"Ошибка обновления промпта: {str(e)}")
                    return jsonify({'error': f'Не удалось обновить промпт: {str(e)}'}), 500
            else:
                return jsonify({'error': 'Не предоставлены данные промпта или конфигурации'}), 400
    except Exception as e:
        return jsonify({'error': f'Непредвиденная ошибка: {str(e)}'}), 500

@app.errorhandler(500)
def handle_500_error(e):
    return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({'error': 'Unexpected error', 'details': str(e)}), 500

# Добавим обработку CORS preflight запросов
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

if __name__ == '__main__':
    app.run(debug=True) 