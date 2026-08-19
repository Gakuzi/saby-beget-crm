# Интеграция с Saby (СБИС)

## Настройка интеграции

### 1. Получение учетных данных Saby API

Для работы интеграции необходимо получить доступы в личном кабинете СБИС:

1. Зайдите в личный кабинет разработчика СБИС: https://online.sbis.ru/developers
2. Создайте новое приложение типа "Сервис"
3. Получите следующие данные:
   - `app_client_id` - идентификатор приложения
   - `app_secret` - секрет приложения
   - `secret_key` - секретный ключ

### 2. Настройка конфигурационного файла

Создайте файл `/opt/backup-reports/.saby_config` со следующим содержимым:

```json
{
    "app_client_id": "ВАШ_APP_CLIENT_ID",
    "app_secret": "ВАШ_APP_SECRET",
    "secret_key": "ВАШ_SECRET_KEY"
}
```

**Важно:** Файл должен иметь права доступа только для чтения владельцем:
```bash
chmod 600 /opt/backup-reports/.saby_config
```

### 3. Структура базы данных

Модуль автоматически создаст следующие таблицы при первом запуске:

- `clients` - клиенты (контрагенты)
- `work_logs` - выполненные работы вручную
- `saby_works` - работы из актов СБИС
- `saby_requests` - обращения/задачи из СБИС
- `saby_documents` - документы (счета, акты)
- `sync_log` - логи синхронизации

### 4. Ежедневная синхронизация

#### Автоматический запуск через cron

Откройте crontab:
```bash
crontab -e
```

Добавьте строку для ежедневного запуска в 02:00:
```cron
0 2 * * * /opt/backup-reports/saby_daily_sync.sh
```

#### Ручной запуск

```bash
python3 saby_integration.py
```

Или для синхронизации конкретного клиента:
```python
from saby_integration import run_daily_sync
result = run_daily_sync(client_id=1)
print(result['logs'])
```

## API методы модуля

### Основные функции

- `run_daily_sync(client_id=None)` - запуск ежедневной синхронизации
- `get_client_saby_data(client_id)` - получение всех данных Saby для клиента
- `get_saby_report(client_id, date_from, date_to)` - отчет по данным Saby за период

### Данные для синхронизации

1. **Договоры** - поиск по ИНН клиента по регламенту "Оказания услуг (Аутсорсинг) с кабинетом"
2. **Акты выполненных работ** - детализация услуг из каждого акта
3. **Обращения/Задачи** - задачи от клиента за последние 30 дней
4. **Счета на оплату** - счета за последние 90 дней

## Тестирование интеграции

### Проверка подключения к Saby

```bash
cd /workspace
python3 -c "
from saby_integration import get_saby_token
logs = []
token = get_saby_token(logs)
print('Logs:', logs)
print('Token:', 'Получен' if token else 'Не получен')
"
```

### Проверка получения договоров

```python
from saby_integration import get_saby_contracts_by_inn, get_saby_token

logs = []
token = get_saby_token(logs)
if token:
    contracts = get_saby_contracts_by_inn("7701234567", token, logs)
    print(f"Найдено договоров: {len(contracts)}")
    for c in contracts:
        print(f"  №{c['number']} от {c['date']}")
print('\\n'.join(logs))
```

## Интеграция с CRM

### Добавление данных в карточку клиента

```python
from saby_integration import get_client_saby_data

data = get_client_saby_data(client_id=1)
print(f"Работ: {len(data['works'])}")
print(f"Обращений: {len(data['requests'])}")
print(f"Документов: {len(data['documents'])}")
```

### Формирование отчета

```python
from saby_integration import get_saby_report

report = get_saby_report(client_id=1, date_from="2025-01-01", date_to="2025-01-31")
for work in report['works']:
    print(f"{work['work_name']}: {work['total_sum']} руб.")
```

## Устранение неполадок

### Ошибка авторизации
- Проверьте правильность учетных данных в `.saby_config`
- Убедитесь, что приложение активно в личном кабинете СБИС
- Проверьте срок действия токена (токен обновляется автоматически)

### Нет данных в базе
- Убедитесь, что у клиента заполнен ИНН
- Проверьте, что договор найден в Saby (регламент "Аутсорсинг")
- Посмотрите логи синхронизации в таблице `sync_log`

### Ошибки API
- Логи ошибок сохраняются в `/var/log/saby_sync.log`
- Проверьте доступность API СБИС: `https://online.sbis.ru/service/sbis-rpc.service`

## Требования

- Python 3.8+
- Библиотеки: `requests`, `sqlite3`
- Доступ в интернет для вызова API СБИС
