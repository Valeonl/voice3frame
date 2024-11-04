import speech_recognition as sr

def process_audio(audio_data):
    recognizer = sr.Recognizer()
    
    try:
        # Распознавание речи
        text = recognizer.recognize_google(audio_data, language='ru-RU')
        return {"success": True, "text": text}
    except sr.UnknownValueError:
        return {"success": False, "error": "Речь не распознана"}
    except sr.RequestError:
        return {"success": False, "error": "Ошибка сервиса распознавания"} 