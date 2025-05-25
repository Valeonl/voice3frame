import { PromptConfig } from '../types/commands';

export const defaultConfig: PromptConfig = {
  role: "Ты - система распознавания команд. Анализируйте входящий текст и определяйте, какая команда выполняется.",
  commands: [
    {
      id: "1",
      displayName: "Обрезка видео",
      className: "cut",
      description: "обрезка видео",
      parameters: [
        {
          name: "begin_time",
          description: "время начала обрезки в формате ЧЧ:ММ:СС (например, '01:30:00' или '00:10:00')",
          defaultValue: "00:00:00"
        },
        {
          name: "end_time",
          description: "время окончания обрезки в формате ЧЧ:ММ:СС (например, '02:00:00' или '-1' для конца видео)",
          defaultValue: "-1"
        },
        {
          name: "media_type",
          description: "тип медиа для обрезки ('video' или 'audio'), определяется из контекста",
          possibleValues: ["video", "audio"],
          defaultValue: "video"
        }
      ],
      examples: [
        "обрезать видео с 5 по 10 минуту",
        "вырезать отрезок с 1:30 до 2:45",
        "Обрежь видео с 10 секунды и до конца",
        "обрезать аудио с 5 по 10 минуту на дорожке 2"
      ]
    },
    {
      id: "2",
      displayName: "Выбор инструмента",
      className: "tools",
      description: "выбор инструмента",
      parameters: [
        {
          name: "tool_name",
          description: "название инструмента на латинице",
          possibleValues: ["Brush", "Text", "Selection"],
          defaultValue: "Selection"
        },
        {
          name: "text_value",
          description: "текст для добавления, если выбран инструмент Text",
          defaultValue: ""
        }
      ],
      examples: [
        "выбери инструмент кисть",
        "установи инструмент текст",
        "выбери инструмент выделение"
      ]
    },
    {
      id: "3",
      displayName: "Скрытие видеослоя",
      className: "hide_video_layer",
      description: "скрытие видеослоя",
      parameters: [
        {
          name: "track_index",
          description: "индекс видеодорожки (например, 1 для первой дорожки), если не указан, то 0",
          defaultValue: "0"
        }
      ],
      examples: [
        "скрыть видео",
        "убрать видеослой",
        "Сделай видео невидимым",
        "Спрячь видеопоток"
      ]
    },
    {
      id: "4",
      displayName: "Заглушение аудиодорожки",
      className: "mute_audio",
      description: "заглушение аудиодорожки",
      parameters: [
        {
          name: "track_index",
          description: "индекс аудиодорожки (например, 1 для первой дорожки), если не указан, то 0",
          defaultValue: "0"
        }
      ],
      examples: [
        "заглушить звук",
        "выключи аудио",
        "замьютить аудиодорожку",
        "отключи звук на второй дорожке"
      ]
    },
    {
      id: "5",
      displayName: "Сохранение проекта",
      className: "save",
      description: "сохранение проекта",
      parameters: [
        {
          name: "name",
          description: "новое имя для сохранения проекта (если указано)",
          defaultValue: ""
        }
      ],
      examples: [
        "Сохранить проект",
        "Сохрани проект как новый"
      ]
    },
    {
      id: "6",
      displayName: "Экспорт видео",
      className: "render",
      description: "экспорт видео",
      parameters: [],
      examples: [
        "Экспортировать видео",
        "Экспортируй проект",
        "Выполни экспорт видео",
        "Сделать экспорт проекта"
      ]
    },
    {
      id: "7",
      displayName: "Отмена действия",
      className: "undo",
      description: "отмена действия",
      parameters: [],
      examples: [
        "Отменить действие",
        "Отмени последнее действие",
        "Вернуть последнее действие",
        "Сделай отмену изменений"
      ]
    },
    {
      id: "8",
      displayName: "Повтор действия",
      className: "redo",
      description: "повтор действия",
      parameters: [],
      examples: [
        "Повторить действие",
        "Повтори последнее действие",
        "Сделай повторение изменений",
        "Выполни повторение действий"
      ]
    },
    {
      id: "9",
      displayName: "Выделение аудиодорожки",
      className: "select_audio_track",
      description: "выделение аудиодорожки",
      parameters: [
        {
          name: "track_index",
          description: "индекс аудиодорожки (например, 1 для первой дорожки), если не указан, то null",
          defaultValue: "null"
        }
      ],
      examples: [
        "выдели первую аудиодорожку",
        "выдели вторую аудиодорожку"
      ]
    },
    {
      id: "10",
      displayName: "Выделение видеодорожки",
      className: "select_video_track",
      description: "выделение видеодорожки",
      parameters: [
        {
          name: "track_index",
          description: "индекс видеодорожки (например, 1 для первой дорожки), если не указан, то null",
          defaultValue: "null"
        }
      ],
      examples: [
        "выдели первую видеодорожку",
        "выдели вторую видеодорожку"
      ]
    },
    {
      id: "11",
      displayName: "Добавление текстовой надписи",
      className: "add_text",
      description: "добавление текстовой надписи",
      parameters: [
        {
          name: "text",
          description: "содержимое текстовой надписи (например, 'Привет мир')",
          defaultValue: ""
        },
        {
          name: "position",
          description: "позиция текста, если указана (например, 'сверху', 'снизу', 'по центру')",
          defaultValue: "center",
          possibleValues: ["сверху", "снизу", "по центру", "center", "top", "bottom"]
        }
      ],
      examples: [
        "добавь текст 'Привет мир'",
        "вставь надпись 'Заголовок'",
        "создай текстовую надпись 'Финальные титры'"
      ]
    }
  ]
}; 