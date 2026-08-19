# 🚀 Быстрый старт: Интеграция CRM с Saby

## ✅ Что уже сделано

1. **Создан модуль `saby_integration.py`** - полная интеграция с API СБИС
2. **Инициализирована база данных** - созданы все необходимые таблицы:
   - `clients` - клиенты
   - `saby_works` - работы из актов СБИС
   - `saby_requests` - обращения/задачи
   - `saby_documents` - документы (счета, акты)
   - `sync_log` - логи синхронизации
   - `work_logs` - ручные записи работ

3. **Скрипт ежедневной синхронизации** - `/opt/backup-reports/saby_daily_sync.sh`

## ⚙️ Настройка (3 шага)

### Шаг 1: Получите ключи доступа Saby API

1. Зайдите в https://online.sbis.ru/developers
2. Создайте приложение типа "Сервис"
3. Скопируйте 3 ключа:
   - `app_client_id`
   - `app_secret`
   - `secret_key`

### Шаг 2: Обновите конфигурационный файл

```bash
nano /opt/backup-reports/.saby_config
```

Замените содержимое на ваши ключи:
```json
{
    "app_client_id": "ВАШ_РЕАЛЬНЫЙ_ID",
    "app_secret": "ВАШ_РЕАЛЬНЫЙ_SECRET",
    "secret_key": "ВАШ_РЕАЛЬНЫЙ_KEY"
}
```

Установите права доступа:
```bash
chmod 600 /opt/backup-reports/.saby_config
```

### Шаг 3: Проверьте работу

```bash
cd /workspace
python3 test_saby_integration.py
```

Если видите `✓ ТОКЕН ПОЛУЧЕН` - всё работает!

## 📅 Настройка автоматической синхронизации

```bash
crontab -e
```

Добавьте строку:
```
0 2 * * * /opt/backup-reports/saby_daily_sync.sh
```

Синхронизация будет запускаться ежедневно в 02:00.

## 📊 Что синхронизируется

| Данные | Период | Источник |
|--------|--------|----------|
| Договоры | Все | По регламенту "Аутсорсинг" |
| Акты выполненных работ | Все | По каждому договору |
| Детализация работ | Все | Из табличной части актов |
| Обращения/Задачи | 30 дней | Задачи по контрагенту |
| Счета на оплату | 90 дней | Счета по контрагенту |

## 🔍 Просмотр данных

### Через Python:
```python
from saby_integration import get_client_saby_data

data = get_client_saby_data(client_id=1)
print(f"Работ: {len(data['works'])}")
print(f"Обращений: {len(data['requests'])}")
```

### Логи синхронизации:
```bash
tail -f /var/log/saby_sync.log
```

## 📁 Структура файлов

```
/workspace/
├── saby_integration.py      # Основной модуль интеграции
├── saby_helper.py           # Старый хелпер (можно удалить)
├── crm_core.py              # Ядро CRM
├── app.py                   # Веб-интерфейс
├── test_saby_integration.py # Тестовый скрипт
├── SABY_INTEGRATION_README.md # Полная документация
└── crm_data.db              # База данных SQLite

/opt/backup-reports/
├── .saby_config             # Конфигурация (ключи API)
└── saby_daily_sync.sh       # Скрипт для cron
```

## ❓ Вопросы?

Смотрите полную документацию в `SABY_INTEGRATION_README.md`
