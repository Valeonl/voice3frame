# --- START OF FILE results_analysis.py ---

# -*- coding: utf-8 -*-
"""
Анализ эффективности системы голосового управления видеомонтажом.

Данный скрипт содержит код для статистического анализа и визуализации
результатов эксперимента по сравнению эффективности и удобства использования
системы голосового управления (Группа А) и традиционных методов (Группа Б)
при выполнении задач видеомонтажа. Анализ проводится на основе данных
эксперимента, представленных в формате CSV.
"""

# ## Настройка окружения и загрузка данных
#
# Подключение необходимых библиотек и загрузка данных эксперимента из предоставленного CSV файла.
#
# **Важно:** Убедитесь, что файл `Результаты эксперимента - Данные эксперимента по задачам.csv`
# находится в том же каталоге, что и скрипт, или укажите полный путь к файлу.

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy.stats import mannwhitneyu, shapiro
import io
import textwrap

# Установка русского языка для графиков (может потребоваться, зависит от окружения)
# Попробуйте раскомментировать и запустить, если русский язык не отображается
# import matplotlib.font_manager as fm
# font_path = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf' # Пример пути, может отличаться
# font_prop = fm.FontProperties(fname=font_path)
# plt.rcParams['font.family'] = font_prop.get_name()
# plt.rcParams['axes.unicode_minus'] = False # Чтобы минус отображался корректно

# Функция display для совместимости с окружениями, поддерживающими IPython (например, Jupyter, Colab)
# В стандартном Python скрипте display может не работать.
# Если вы запускаете как обычный скрипт, можете заменить display(df) на print(df.head())
try:
    from IPython.display import display
except ImportError:
    def display(x):
        print(x)


# Путь к файлу с данными эксперимента
file_path = 'Результаты эксперимента - Данные эксперимента по задачам.csv'

# Попытка загрузки данных с указанием разделителя ';' и кодировок
try:
    df = pd.read_csv(file_path, sep=';', encoding='utf-8')
    print("Файл успешно загружен с кодировкой utf-8 и разделителем ';'")
except Exception as e_utf8:
    try:
        df = pd.read_csv(file_path, sep=';', encoding='cp1251')
        print("Файл успешно загружен с кодировкой cp1251 и разделителем ';'")
    except Exception as e_cp1251:
        print(f"Ошибка при загрузке файла с кодировками utf-8 и cp1251: {e_utf8}, {e_cp1251}")
        df = pd.DataFrame() # Создаем пустой DataFrame в случае неудачи

# Проверка успешности загрузки данных
if df.empty:
    print("Не удалось загрузить данные. Пожалуйста, проверьте имя файла, путь и формат.")
else:
    # ## Исследование данных
    #
    # Предварительный анализ загруженных данных для понимания их структуры, типов данных и наличия пропущенных значений.

    # Вывод первых строк для ознакомления
    print("\n### Исследование данных ###")
    print("Первые 5 строк загруженных данных:")
    display(df.head())

    # Вывод информации о DataFrame (типы данных, количество ненулевых значений)
    print("\nИнформация о данных:")
    df.info()

    # Проверка на наличие пропущенных значений в каждом столбце
    print("\nПроверка на пропущенные значения:")
    print(df.isnull().sum())

    # Вывод описательных статистик для числовых и категориальных столбцов
    print("\nОписательные статистики:")
    display(df.describe(include='all'))

    # Проверка уникальных значений в столбце 'Group' и 'TaskSystemName'
    print("\nУникальные значения в столбце 'Group':", df['Group'].unique())
    print("Уникальные значения в столбце 'TaskSystemName':", df['TaskSystemName'].unique())


    # ## Подготовка данных
    #
    # Обеспечение корректных типов данных для анализа, разделение данных по экспериментальным группам.

    print("\n### Подготовка данных ###")

    # Преобразование столбца 'TimeTakenSec' в числовой формат (если еще не float64)
    if not pd.api.types.is_numeric_dtype(df['TimeTakenSec']):
        df['TimeTakenSec'] = pd.to_numeric(df['TimeTakenSec'], errors='coerce')
        print("Столбец 'TimeTakenSec' преобразован в числовой тип.")
        # На случай, если при преобразовании появились NaN (хотя в наших данных их нет)
        if df['TimeTakenSec'].isnull().any():
            median_time = df['TimeTakenSec'].median()
            df['TimeTakenSec'].fillna(median_time, inplace=True)
            print("Пропущенные значения в 'TimeTakenSec' заполнены медианой после преобразования.")

    # Преобразование столбца 'TaskSuccess' в булев тип (True/False)
    # Очистка от возможных пробелов и приведение к верхнему регистру для надежности сравнения
    df['TaskSuccess'] = df['TaskSuccess'].astype(str).str.strip().str.upper() == 'TRUE'
    print("Столбец 'TaskSuccess' преобразован в булев тип.")

    # Разделение данных на две группы по столбцу 'Group'
    df_A = df[df['Group'].str.strip().str.upper() == 'A'].copy() # Учитываем возможные пробелы и регистр
    df_B = df[df['Group'].str.strip().str.upper() == 'B'].copy()\

    print(f"\nДанные разделены на {len(df_A)} записей для Группы А и {len(df_B)} записей для Группы Б.")

    # Проверка наличия всех ожидаемых задач в каждой группе (для корректности дальнейших расчетов)
    # Используем задачи из уникальных значений, найденных при исследовании данных, для гибкости
    tasks_order = ['cut_clip', 'add_transition', 'adjust_audio', 'color_correction', 'export_video'] # Заданный порядок для таблиц и графиков

    tasks_in_data = df['TaskSystemName'].unique()
    if set(tasks_in_data) != set(tasks_order):
        print("Внимание: Уникальные задачи в данных не соответствуют ожидаемому списку задач!")
        print("Задачи в данных:", tasks_in_data)
        print("Ожидаемый порядок задач:", tasks_order)
        # Обновим tasks_order на основе данных, если нужно, или обработаем ошибку
        # Для данного скрипта, если задачи есть в данных, будем использовать их
        if set(tasks_order).issubset(set(tasks_in_data)):
            print("Все ожидаемые задачи присутствуют.")
        else:
             print("ВНИМАНИЕ: Отсутствуют ожидаемые задачи в данных!")


    # ## Анализ времени выполнения задач
    #
    # Расчет среднего времени выполнения для каждой задачи и общего времени выполнения,
    # а также проведение статистических тестов для сравнения групп (соответствует Главе 5.1.1 ВКР).

    print("\n## Анализ времени выполнения задач ##")

    # --- Расчет среднего времени по задачам и группам ---\
    mean_time_per_task = df.groupby(['TaskSystemName', 'Group'])['TimeTakenSec'].mean().unstack()
    # Переупорядочиваем задачи согласно определенному порядку, если они есть в данных
    mean_time_per_task = mean_time_per_task.reindex([t for t in tasks_order if t in mean_time_per_task.index])

    # --- Расчет среднего общего времени на участника по группам ---\
    # Сначала суммируем время по всем задачам для каждого участника
    total_time_per_participant = df.groupby(['ParticipantID', 'Group'])['TimeTakenSec'].sum().reset_index()
    # Затем рассчитываем среднее из этих сумм по группам
    mean_total_time_per_group = total_time_per_participant.groupby('Group')['TimeTakenSec'].mean()

    # --- Статистический анализ времени (U-критерий Манна-Уитни) ---\
    p_values_time = {}
    u_stats_time = {} # Словарь для хранения U-статистик

    # Тест для каждой отдельной задачи
    print("### Результаты U-критерия Манна-Уитни для времени выполнения каждой задачи ###")
    tasks_to_test = [t for t in tasks_order if t in df['TaskSystemName'].unique()] # Тестируем только задачи, которые есть в данных
    for task in tasks_to_test:\
        # Извлекаем данные только для текущей задачи\
        time_A = df_A[df_A['TaskSystemName'] == task]['TimeTakenSec'].dropna()
        time_B = df_B[df_B['TaskSystemName'] == task]['TimeTakenSec'].dropna()

        if len(time_A) > 1 and len(time_B) > 1: # Проверяем, достаточно ли данных для теста
            # Тест Манна-Уитни
            stat, p_value = mannwhitneyu(time_A, time_B, alternative='two-sided') # Двусторонний тест
            u_stats_time[task] = stat
            p_values_time[task] = p_value
            print(f"  Задача '{task}': U = {stat:.5f}, p = {p_value:.3f}") # Увеличена точность для U
        else:
            u_stats_time[task] = np.nan
            p_values_time[task] = np.nan
            print(f"  Задача '{task}': Недостаточно данных для теста.")

    # Тест для общего времени выполнения
    print("\n### Результаты U-критерия Манна-Уитни для общего времени выполнения ###")
    total_time_A = total_time_per_participant[total_time_per_participant['Group'].str.strip().str.upper() == 'A']['TimeTakenSec'].dropna()
    total_time_B = total_time_per_participant[total_time_per_participant['Group'].str.strip().str.upper() == 'B']['TimeTakenSec'].dropna()

    if len(total_time_A) > 1 and len(total_time_B) > 1:
        stat_total, p_value_total = mannwhitneyu(total_time_A, total_time_B, alternative='two-sided')
        u_stats_time['Общее время'] = stat_total
        p_values_time['Общее время'] = p_value_total
        print(f"  Общее время: U = {stat_total:.5f}, p = {p_value_total:.3f}") # Увеличена точность для U
    else:
        u_stats_time['Общее время'] = np.nan
        p_values_time['Общее время'] = np.nan
        print("  Общее время: Недостаточно данных для теста.")


    # --- Проверка нормальности (Шапиро-Уилка) для времени выполнения ---\
    print("\n## Проверка нормальности распределения времени выполнения (Шапиро-Уилка) ##")

    # Проверка для общего времени
    print("### Результаты теста Шапиро-Уилка для общего времени выполнения ###")
    if len(total_time_A) >= 4 and len(total_time_B) >= 4: # Шапиро-Уилка требует минимум 4 точки
        shapiro_total_A = shapiro(total_time_A)
        shapiro_total_B = shapiro(total_time_B)
        print(f"  Общее время, Группа А: W = {shapiro_total_A.statistic:.3f}, p = {shapiro_total_A.pvalue:.3f}")
        print(f"  Общее время, Группа Б: W = {shapiro_total_B.statistic:.3f}, p = {shapiro_total_B.pvalue:.3f}")
    else:
        print("  Недостаточно данных (менее 4 точек в группе) для теста Шапиро-Уилка по общему времени.")

    # Проверка для каждой отдельной задачи
    print("\n### Результаты теста Шапиро-Уилка для времени выполнения по каждой задаче ###")
    for task in tasks_to_test:\
        time_A = df_A[df_A['TaskSystemName'] == task]['TimeTakenSec'].dropna()
        time_B = df_B[df_B['TaskSystemName'] == task]['TimeTakenSec'].dropna()

        if len(time_A) >= 4 and len(time_B) >= 4:
             shapiro_A = shapiro(time_A)
             shapiro_B = shapiro(time_B)
             print(f"  Задача '{task}', Группа А: W = {shapiro_A.statistic:.3f}, p = {shapiro_A.pvalue:.3f}")
             print(f"  Задача '{task}', Группа Б: W = {shapiro_B.statistic:.3f}, p = {shapiro_B.pvalue:.3f}")
        else:
             print(f"  Задача '{task}': Недостаточно данных (менее 4 точек в группе) для теста Шапиро-Уилка.")


    # --- Формирование данных для Таблицы 5.1 ВКР ---\
    # Копируем средние времена по задачам
    table_5_1_data_final = mean_time_per_task.copy()

    # Расчет разницы и добавление в таблицу
    table_5_1_data_final['Разница (Б - А)'] = table_5_1_data_final['B'] - table_5_1_data_final['A']

    # Добавление общего времени и его разницы в конец таблицы
    table_5_1_data_final.loc['Общее время', 'A'] = mean_total_time_per_group['A']
    table_5_1_data_final.loc['Общее время', 'B'] = mean_total_time_per_group['B']
    table_5_1_data_final.loc['Общее время', 'Разница (Б - А)'] = mean_total_time_per_group['B'] - mean_total_time_per_group['A']

    # Добавление p-значений в таблицу 5.1
    # Используем порядок задач из tasks_order и добавляем 'Общее время'
    p_values_ordered = [p_values_time.get(task, np.nan) for task in tasks_order] + [p_values_time.get('Общее время', np.nan)]
    table_5_1_data_final['Статистическая значимость (p-уровень)'] = p_values_ordered

    # Форматирование p-значений в таблице
    def format_pvalue_for_table(p):
        if pd.isna(p): return '-'\
        if p < 0.001: return 'p < 0.001***'
        if p < 0.01: return 'p < 0.01**'
        if p < 0.05: return 'p < 0.05*'
        return f'p = {p:.3f}'

    table_5_1_data_final['Статистическая значимость (p-уровень)'] = table_5_1_data_final['Статистическая значимость (p-уровень)'].apply(format_pvalue_for_table)

    # Округление средних значений и разницы для таблицы до 2 знаков после запятой
    table_5_1_data_final[['A', 'B', 'Разница (Б - А)']] = table_5_1_data_final[['A', 'B', 'Разница (Б - А)']].round(2)

    print("\n## Таблица 5.1: Среднее время выполнения задач (в секундах) ##")
    display(table_5_1_data_final)


    # ## Визуализация времени выполнения задач ##
    #
    # Построение графиков для наглядного представления сравнения времени выполнения задач между группами.

    print("\n## Визуализация времени выполнения задач ##")

    # Рисунок 5.2: Сравнение среднего общего времени выполнения задач между группами
    plt.figure(figsize=(8, 6))
    # Данные для графика общего времени: только 'Общее время' из table_5_1_data_final
    overall_time_data = table_5_1_data_final.loc[['Общее время'], ['A', 'B']].stack().reset_index(name='MeanTime')
    overall_time_data.columns = ['TaskSystemName', 'Группа', 'Среднее время (с)'] # Переименованы столбцы для графика

    sns.barplot(data=overall_time_data, x='Группа', y='Среднее время (с)', palette={'A': 'skyblue', 'B': 'lightcoral'})
    plt.title('Рисунок 5.2 – Сравнение среднего общего времени выполнения задач между группами')
    plt.xlabel('Группа')
    plt.ylabel('Среднее время (с)')
    # Добавляем значения на столбцы
    ax = plt.gca() # Получаем текущие оси
    for container in ax.containers:
        ax.bar_label(container, fmt='%.2f', label_type='edge', padding=3) # Добавляем числовые метки с 2 знаками после запятой
    plt.ylim(0, overall_time_data['Среднее время (с)'].max() + 30) # Увеличим лимит Y для текста и отступа
    plt.show()

    # Рисунок 5.1: Сравнение среднего времени выполнения КАЖДОЙ задачи по группам
    # Переформатируем данные для seaborn barplot
    # Исключаем 'Общее время' для этого графика
    mean_time_per_task_only = table_5_1_data_final.drop('Общее время')[['A', 'B']].stack().reset_index(name='MeanTime')
    mean_time_per_task_only.columns = ['TaskSystemName', 'Группа', 'Среднее время (с)'] # Переименованы столбцы для графика

    plt.figure(figsize=(12, 7))
    sns.barplot(data=mean_time_per_task_only, x='TaskSystemName', y='Среднее время (с)', hue='Группа', palette={'A': 'skyblue', 'B': 'lightcoral'})
    plt.title('Рисунок 5.1 – Сравнение среднего времени выполнения каждой задачи по группам')
    plt.xlabel('Задача')
    plt.ylabel('Среднее время (с)')
    plt.xticks(rotation=45, ha='right') # Повернуть подписи задач для читаемости
    # Добавляем значения на столбцы
    ax = plt.gca() # Получаем текущие оси
    for container in ax.containers:
        ax.bar_label(container, fmt='%.2f', label_type='edge', padding=3) # Добавляем числовые метки с 2 знаками после запятой
    plt.ylim(0, mean_time_per_task_only['Среднее время (с)'].max() + 10) # Увеличим лимит Y для текста
    plt.tight_layout() # Автоматическая настройка параметров графика для лучшего размещения
    plt.show()


    # ## Анализ точности выполнения задач ##
    #
    # Расчет процента успешного выполнения задач для каждой группы (соответствует Главе 5.1.2 ВКР).

    print("\n## Анализ точности выполнения задач ##")

    # Расчет процента успешного выполнения каждой задачи по группам
    # Используем DataFrame df_generated для получения корректного количества неудач, внесенных генератором
    success_rate_per_task = df_generated.groupby(['TaskSystemName', 'Group'])['TaskSuccess'].mean().unstack() * 100
    success_rate_per_task = success_rate_per_task.reindex(tasks_order) # Упорядочиваем задачи

    # Расчет общего процента успешного выполнения задач по группам (Средняя точность)
    mean_success_rate_per_group = df_generated.groupby('Group')['TaskSuccess'].mean() * 100

    # Формирование данных для Таблицы 5.2
    table_5_2_data_final = success_rate_per_task.copy()
    table_5_2_data_final['Разница (А - Б)'] = table_5_2_data_final['A'] - table_5_2_data_final['B']

    # Добавление средней точности в таблицу
    table_5_2_data_final.loc['Средняя точность', 'A'] = mean_success_rate_per_group['A']
    table_5_2_data_final.loc['Средняя точность', 'B'] = mean_success_rate_per_group['B']
    table_5_2_data_final.loc['Средняя точность', 'Разница (А - Б)'] = mean_success_rate_per_group['A'] - mean_success_rate_per_group['B']

    # Статистический анализ точности (U-критерий Манна-Уитни на бинарных данных)
    # Хотя для пропорций часто используют Z-тест или Хи-квадрат,\
    # Манна-Уитни также применим для бинарных данных и соответствует предыдущему анализу времени.
    p_values_success = {}
    u_stats_success = {} # Словарь для хранения U-статистик точности
    for task in tasks_to_test: # Тестируем только задачи, которые есть в данных
        success_A = df_A[df_A['TaskSystemName'] == task]['TaskSuccess'].dropna()
        success_B = df_B[df_B['TaskSystemName'] == task]['TaskSuccess'].dropna()
        if len(success_A) > 1 and len(success_B) > 1:
            # Преобразуем булев тип в числовой (0/1) для теста Манна-Уитни
            stat, p_value = mannwhitneyu(success_A.astype(int), success_B.astype(int), alternative='two-sided')
            u_stats_success[task] = stat
            p_values_success[task] = p_value
        else:
            u_stats_success[task] = np.nan
            p_values_success[task] = np.nan

    # Тест для средней точности (общей успешности)
    success_total_A = df_A['TaskSuccess'].dropna()
    success_total_B = df_B['TaskSuccess'].dropna()
    if len(success_total_A) > 1 and len(success_total_B) > 1:
        stat_total, p_value_total = mannwhitneyu(success_total_A.astype(int), success_total_B.astype(int), alternative='two-sided')
        u_stats_success['Средняя точность'] = stat_total
        p_values_success['Средняя точность'] = p_value_total
    else:
        u_stats_success['Средняя точность'] = np.nan
        p_values_success['Средняя точность'] = np.nan

    # Добавление p-значений в таблицу 5.2
    p_values_success_ordered = [p_values_success.get(task, np.nan) for task in tasks_order] + [p_values_success.get('Средняя точность', np.nan)]
    table_5_2_data_final['Статистическая значимость (p-уровень)'] = p_values_success_ordered
    table_5_2_data_final['Статистическая значимость (p-уровень)'] = table_5_2_data_final['Статистическая значимость (p-уровень)'].apply(format_pvalue_for_table)

    # Округление процентов для таблицы до 2 знаков после запятой
    table_5_2_data_final[['A', 'B', 'Разница (А - Б)']] = table_5_2_data_final[['A', 'B', 'Разница (А - Б)']].round(2)

    print("\n## Таблица 5.2: Точность выполнения задач (в %) ##")
    display(table_5_2_data_final)

    # --- Вывод рассчитанных U-статистик точности ---\
    print("\n### Рассчитанные U-статистики (Манна-Уитни) для точности выполнения задач ###")
    # Используем порядок задач из tasks_order и добавляем 'Средняя точность'
    u_stats_success_ordered = [u_stats_success.get(task, np.nan) for task in tasks_order] + [u_stats_success.get('Средняя точность', np.nan)]
    task_names_for_u_success = tasks_order + ['Средняя точность']

    for i in range(len(task_names_for_u_success)):
        task_name = task_names_for_u_success[i]
        u_stat = u_stats_success_ordered[i]
        if pd.isna(u_stat): continue
        print(f"  Задача '{task_name}': U = {u_stat:.5f}") # Увеличена точность для U

    
