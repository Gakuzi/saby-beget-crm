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
    client_id INTEGER,
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

# Миграция: добавляем отсутствующие колонки (если таблица была ранее более простой)
expected_cols = {
    'site_name': 'TEXT', 'site_url': 'TEXT', 'site_domain': 'TEXT', 'client_id': 'INTEGER', 'filename': 'TEXT',
    'backup_date': 'TEXT', 'size_mb': 'REAL', 'detected_at': 'TEXT', 'status': 'TEXT',
    'source': 'TEXT', 'error': 'TEXT', 'extra': 'TEXT'
}

# Создать таблицу site_mapping для сопоставления домен -> client_id
cursor.execute('''
CREATE TABLE IF NOT EXISTS site_mapping (
    site_domain TEXT PRIMARY KEY,
    client_id INTEGER
)
''')
conn.commit()

cursor.execute("PRAGMA table_info('backup_history')")
existing = {row[1] for row in cursor.fetchall()}
for col, coltype in expected_cols.items():
    if col not in existing:
        try:
            cursor.execute(f"ALTER TABLE backup_history ADD COLUMN {col} {coltype}")
            print(f"[MIGRATE] Added missing column: {col}")
        except Exception as e:
            print(f"[MIGRATE] Can't add column {col}: {e}")
conn.commit()

# Создаем таблицу host_events для хранения событий хостинга
cursor.execute('''
CREATE TABLE IF NOT EXISTS host_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    host_account TEXT,
    site TEXT,
    event_type TEXT,
    details TEXT,
    event_time INTEGER,
    source TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
)
''')
conn.commit()

# Список сайтов и агент-URL/ключей — при необходимости расширите
sites = [
    {"url": "https://lens29.ru/backup_check.php", "key": "klimov", "name": "Клиника ЛЕНС"},
    {"url": "https://uniklinika.ru/backup_check.php", "key": "klimov", "name": "Университетская клиника"},
    {"url": "https://xn--29-6kcaxawaglcjiqe8c8o.xn--p1ai/backup_check.php", "key": "klimov", "name": "Семейная клиника"}
]

# Попытка автосопоставления доменов к клиентам на основе crm_data.db (sites поле в clients)
try:
    crm_db = '/opt/backup-reports/crm_data.db'
    if os.path.exists(crm_db):
        cconn = sqlite3.connect(crm_db)
        ccur = cconn.cursor()
        ccur.execute('SELECT id, sites FROM clients')
        rows = ccur.fetchall()
        for rid, sites_str in rows:
            if not sites_str:
                continue
            parts = [s.strip().lower().replace('https://','').replace('http://','').split('/')[0] for s in sites_str.split(',') if s.strip()]
            for d in parts:
                # insert mapping if not exists
                try:
                    cursor.execute('INSERT OR IGNORE INTO site_mapping(site_domain, client_id) VALUES (?, ?)', (d, rid))
                except Exception:
                    pass
        cconn.commit()
        cconn.close()
except Exception as e:
    print(f'[MAPPING] failed to build site_mapping: {e}')

# Также добавим существующие mapping из backup_history: если есть домен и не маппинг, попробуем сопоставить по имени
try:
    cursor.execute('SELECT DISTINCT site_domain FROM backup_history WHERE site_domain IS NOT NULL AND site_domain != ""')
    domains = [r[0] for r in cursor.fetchall()]
    crm_db = '/opt/backup-reports/crm_data.db'
    if os.path.exists(crm_db):
        cconn = sqlite3.connect(crm_db)
        ccur = cconn.cursor()
        for d in domains:
            ccur.execute('SELECT id, sites, company_name FROM clients')
            for rid, sites_str, cname in ccur.fetchall():
                matched = False
                if sites_str:
                    parts = [s.strip().lower().replace('https://','').replace('http://','').split('/')[0] for s in sites_str.split(',') if s.strip()]
                    if d in parts:
                        cursor.execute('INSERT OR IGNORE INTO site_mapping(site_domain, client_id) VALUES (?, ?)', (d, rid))
                        matched = True
                if not matched and cname and cname.strip().lower() == d:
                    cursor.execute('INSERT OR IGNORE INTO site_mapping(site_domain, client_id) VALUES (?, ?)', (d, rid))
        cconn.commit()
        cconn.close()
except Exception as e:
    print(f'[MAPPING] secondary mapping failed: {e}')

# Refresh commit
conn.commit()

# Обновим существующие записи backup_history, установив client_id по site_mapping где возможно
try:
    cursor.execute('SELECT site_domain, client_id FROM site_mapping')
    for sd, cid in cursor.fetchall():
        if sd:
            cursor.execute('UPDATE backup_history SET client_id = ? WHERE site_domain = ? AND (client_id IS NULL OR client_id = "")', (cid, sd))
    conn.commit()
    print('[MAPPING] updated existing backup_history with client_id where possible')
except Exception as e:
    print(f'[MAPPING] update existing failed: {e}')

# Сбор событий с Beget для каждого client, если в карточке заданы доступы
try:
    import beget_helper
    import time
    crm_db = '/opt/backup-reports/crm_data.db'
    if os.path.exists(crm_db):
        cconn = sqlite3.connect(crm_db)
        ccur = cconn.cursor()
        # Получить всех клиентов, у которых есть доступы
        ccur.execute('SELECT id, beget_login, beget_password FROM clients')
        clients = ccur.fetchall()
        now_ts = int(time.time())
        start_ts = now_ts - 30*24*3600  # за последний месяц
        for cid, blogin, bpass in clients:
            if not blogin or not bpass:
                continue
            try:
                events = beget_helper.get_events(blogin, bpass, start_ts, now_ts)
                if events:
                    for ev in events:
                        try:
                            cursor.execute('INSERT INTO host_events (client_id, host_account, site, event_type, details, event_time, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                           (cid, blogin, ev.get('details', {}).get('domain') or ev.get('details', {}).get('site') or ev.get('details', {}).get('domain_fqdn') or None, ev.get('event_type'), json.dumps(ev.get('details', {}), ensure_ascii=False), ev.get('event_time') or now_ts, ev.get('source')))
                        except Exception:
                            pass
                    conn.commit()
                    print(f"[BEGET] client {cid}: saved {len(events)} events")
            except Exception as e:
                print(f"[BEGET] error for client {cid}: {e}")
        cconn.close()
except Exception as e:
    print(f'[BEGET] failed to collect events: {e}')


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

            # determine client_id from site_mapping if available
            client_id = None
            try:
                cursor.execute('SELECT client_id FROM site_mapping WHERE site_domain = ?', (site_domain,))
                rmap = cursor.fetchone()
                if rmap:
                    client_id = rmap[0]
            except Exception:
                client_id = None

            # Проверяем, есть ли уже запись с таким сайтом и датой
            cursor.execute(
                "SELECT id FROM backup_history WHERE site_domain = ? AND backup_date = ?",
                (site_domain, b_date)
            )
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO backup_history (site_name, site_url, site_domain, client_id, filename, backup_date, size_mb, detected_at, status, source, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (site_name, site_url, site_domain, client_id, filename, b_date, b_size, now_str, 'ok', 'agent', json.dumps(data, ensure_ascii=False))
                )
                conn.commit()
                print(f"[OK] {site_name} ({site_domain}) - saved backup {b_date} / {b_size} MB client_id={client_id}")
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
