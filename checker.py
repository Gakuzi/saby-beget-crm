import urllib.request
import json
import datetime
import sqlite3
import os

db_path = "/opt/backup-reports/backups.db"

# Создаем базу и таблицу сразу при запуске
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute('''
CREATE TABLE IF NOT EXISTS backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_name TEXT,
    backup_date TEXT,
    size_mb REAL,
    detected_at TEXT
)
''')
conn.commit()

sites = [
    {"url": "https://lens29.ru/backup_check.php", "key": "klimov", "name": "Клиника ЛЕНС"},
    {"url": "https://uniklinika.ru/backup_check.php", "key": "klimov", "name": "Университетская клиника"},
    {"url": "https://xn--29-6kcaxawaglcjiqe8c8o.xn--p1ai/backup_check.php", "key": "klimov", "name": "Семейная клиника"}
]

now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

for site in sites:
    try:
        url = f"{site['url']}?key={site['key']}"
        req = urllib.request.urlopen(url, timeout=10)
        data = json.loads(req.read().decode('utf-8'))

        if data['status'] == 'ok':
            b_date = data['date']
            b_size = data['size_mb']
            
            cursor.execute(
                "SELECT id FROM backup_history WHERE site_name = ? AND backup_date = ?",
                (site['name'], b_date)
            )
            row = cursor.fetchone()
            
            if not row:
                cursor.execute(
                    "INSERT INTO backup_history (site_name, backup_date, size_mb, detected_at) VALUES (?, ?, ?, ?)",
                    (site['name'], b_date, b_size, now_str)
                )
                conn.commit()
            print(f"Сайт: {site['name']} | Проверен, данные актуальны")
        else:
            print(f"Сайт: {site['name']} | Ошибка от сайта: {data['message']}")
    except Exception as e:
        print(f"Сайт: {site['name']} | Ошибка связи: {str(e)}")

conn.close()
print("Сбор и сохранение данных в базу завершены")
