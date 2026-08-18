#!/usr/bin/env python3
# Улучшенный сборщик бэкапов с сайтов (поддерживает backup_check.php agents)
import urllib.request
import json
import datetime
import sqlite3
import os
from urllib.parse import urlparse

# Путь к базе (на сервере используется /opt/backup-reports/backups.db)
db_path = os.environ.get('BACKUPS_DB', '/opt/backup-reports/backups.db')

os.makedirs(os.path.dirname(db_path), exist_ok=True)
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Создаем таблицу с расширенной схемой если не существует
cursor.execute('''
CREATE TABLE IF NOT EXISTS backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_name TEXT,
    site_url TEXT,
    site_domain TEXT,
    filename TEXT,
    backup_date TEXT,
    size_mb REAL,
    detected_at TEXT,
    status TEXT,
    source TEXT,
    error TEXT,
    extra TEXT
)
''')
conn.commit()

# Список сайтов и агент-URL/ключей — при необходимости расширите
sites = [
    {"url": "https://lens29.ru/backup_check.php", "key": "klimov", "name": "Клиника ЛЕНС"},
    {"url": "https://uniklinika.ru/backup_check.php", "key": "klimov", "name": "Университетская клиника"},
    {"url": "https://xn--29-6kcaxawaglcjiqe8c8o.xn--p1ai/backup_check.php", "key": "klimov", "name": "Семейная клиника"}
]

now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

for site in sites:
    site_url = site.get('url')
    site_name = site.get('name') or site_url
    site_key = site.get('key')
    parsed = urlparse(site_url)
    site_domain = parsed.hostname or ''

    try:
        # формируем URL с ключом
        url = site_url
        if site_key:
            url = f"{site_url}?key={site_key}" if '?' not in site_url else f"{site_url}&key={site_key}"

        req = urllib.request.urlopen(url, timeout=15)
        raw = req.read().decode('utf-8')
        try:
            data = json.loads(raw)
        except Exception:
            # Если ответ не в JSON — пробуем обернуть или записать как ошибку
            data = {"status": "error", "message": f"Invalid JSON response: {raw[:200]}"}

        if data.get('status') == 'ok':
            b_date = data.get('date')
            b_size = data.get('size_mb')
            filename = data.get('filename') if 'filename' in data else None

            # Проверяем, есть ли уже запись с таким сайтом и датой
            cursor.execute(
                "SELECT id FROM backup_history WHERE site_domain = ? AND backup_date = ?",
                (site_domain, b_date)
            )
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO backup_history (site_name, site_url, site_domain, filename, backup_date, size_mb, detected_at, status, source, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (site_name, site_url, site_domain, filename, b_date, b_size, now_str, 'ok', 'agent', json.dumps(data, ensure_ascii=False))
                )
                conn.commit()
                print(f"[OK] {site_name} ({site_domain}) - saved backup {b_date} / {b_size} MB")
            else:
                print(f"[SKIP] {site_name} ({site_domain}) - already recorded {b_date}")
        else:
            err = data.get('message') or data.get('error') or 'Unknown error from agent'
            cursor.execute(
                "INSERT INTO backup_history (site_name, site_url, site_domain, backup_date, size_mb, detected_at, status, source, error, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (site_name, site_url, site_domain, None, None, now_str, 'error', 'agent', err, json.dumps(data, ensure_ascii=False))
            )
            conn.commit()
            print(f"[ERR] {site_name} ({site_domain}) - agent error: {err}")

    except Exception as e:
        # Ошибка связи или таймаут
        err = str(e)
        cursor.execute(
            "INSERT INTO backup_history (site_name, site_url, site_domain, backup_date, size_mb, detected_at, status, source, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (site_name, site_url, site_domain, None, None, now_str, 'error', 'agent', err)
        )
        conn.commit()
        print(f"[FAIL] {site_name} ({site_domain}) - connection error: {err}")

conn.close()
print('Сбор и сохранение данных в базу завершены')
