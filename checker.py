#!/usr/bin/env python3
# Улучшенный сборщик бэкапов с сайтов (поддерживает backup_check.php agents)
import urllib.request
import json
import datetime
import sqlite3
import os
from urllib.parse import urlparse
import ssl

# Option to skip SSL verification for testing (set SKIP_SSL_VERIFY=1 to enable)
skip_ssl = os.environ.get('SKIP_SSL_VERIFY', '0').lower() in ('1', 'true', 'yes')
if skip_ssl:
    ssl_ctx = ssl._create_unverified_context()
else:
    ssl_ctx = ssl.create_default_context()

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

# Создаем таблицу для ежедневных снимков баланса
cursor.execute('''
CREATE TABLE IF NOT EXISTS balance_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    balance REAL,
    currency TEXT,
    snapshot_ts INTEGER,
    details TEXT,
    created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
)
''')
conn.commit()

# Список сайтов и агент-URL/ключей — при необходимости расширите
sites = [
    {"url": "https://lens29.ru/backup_check.php", "key": "Klimov", "name": "Клиника ЛЕНС"},
    {"url": "https://uniklinika.ru/backup_check.php", "key": "Klimov", "name": "Университетская клиника"},
    {"url": "https://xn--29-6kcaxawaglcjiqe8c8o.xn--p1ai/backup_check.php", "key": "Klimov", "name": "Семейная клиника"}
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
        # Ensure compatibility if beget_api_key column is not present
        cols = [c[1] for c in ccur.execute("PRAGMA table_info(clients)").fetchall()]
        select_fields = ['id', 'beget_login', 'beget_password']
        has_api = False
        if 'beget_api_key' in cols:
            select_fields.append('beget_api_key')
            has_api = True
        q = 'SELECT ' + ','.join(select_fields) + ' FROM clients'
        ccur.execute(q)
        clients = ccur.fetchall()
        now_ts = int(time.time())
        start_ts = now_ts - 30*24*3600  # за последний месяц
        for row in clients:
            if has_api:
                cid, blogin, bpass, bapi = row
            else:
                cid, blogin, bpass = row
                bapi = None
            if not blogin and not bapi:
                continue
            try:
                # получим подробный снимок состояния от Beget (domains/sites/databases/mailboxes)
                snapshot = beget_helper.get_full_beget_report(blogin, bpass, api_key=bapi)
                # всегда сохраняем snapshot как запись
                try:
                    sdata = {'timestamp': now_ts, 'snapshot': snapshot}
                    cursor.execute('INSERT INTO host_events (client_id, host_account, site, event_type, details, event_time, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                   (cid, blogin or bapi, None, 'beget_snapshot', json.dumps(sdata, ensure_ascii=False), now_ts, 'beget_snapshot'))
                    conn.commit()
                except Exception:
                    pass

                # сохранение ежедневного снимка баланса
                try:
                    bal = beget_helper.get_account_balance(blogin, bpass, api_key=bapi)
                    balance_val = bal.get('balance')
                    currency = bal.get('currency')
                    # вставляем только один снимок в день для клиента
                    cursor.execute("SELECT id FROM balance_snapshots WHERE client_id = ? AND date(created_at) = date('now')", (cid,))
                    if not cursor.fetchone():
                        cursor.execute('INSERT INTO balance_snapshots (client_id, balance, currency, snapshot_ts, details) VALUES (?, ?, ?, ?, ?)',
                                       (cid, balance_val, currency, now_ts, json.dumps(bal, ensure_ascii=False)))
                        conn.commit()
                except Exception:
                    pass

                # попытаемся сделать простую дифф-детекцию: если есть предыдущий snapshot
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT details, event_time FROM host_events WHERE client_id = ? AND source = 'beget_snapshot' ORDER BY event_time DESC LIMIT 2", (cid,))
                    rows = cur.fetchall()
                    if len(rows) >= 2:
                        curr = json.loads(rows[0][0]) if rows[0][0] else {}
                        prev = json.loads(rows[1][0]) if rows[1][0] else {}
                        prev_snap = prev.get('snapshot', {})
                        curr_snap = curr.get('snapshot', {})
                        # domains
                        prev_domains = set([d.get('fqdn') or d.get('domain') for d in prev_snap.get('domains', []) if d])
                        curr_domains = set([d.get('fqdn') or d.get('domain') for d in curr_snap.get('domains', []) if d])
                        # Use neutral "diff" events with details explaining that they were detected by snapshot comparison
                        prev_ts = rows[1][1] if len(rows) >= 2 else None
                        curr_ts = rows[0][1] if len(rows) >= 1 else now_ts
                        for dom in (curr_domains - prev_domains):
                            try:
                                details = {'action': 'created', 'domain': dom, 'detected_at': now_ts, 'prev_snapshot': prev_ts, 'curr_snapshot': curr_ts, 'method': 'snapshot_diff'}
                                cursor.execute('INSERT INTO host_events (client_id, host_account, site, event_type, details, event_time, source) VALUES (?, ?, ?, ?, ?, ?, ?)', (cid, blogin, dom, 'domain_diff', json.dumps(details, ensure_ascii=False), now_ts, 'beget_diff'))
                            except Exception:
                                pass
                        for dom in (prev_domains - curr_domains):
                            try:
                                details = {'action': 'removed', 'domain': dom, 'detected_at': now_ts, 'prev_snapshot': prev_ts, 'curr_snapshot': curr_ts, 'method': 'snapshot_diff'}
                                cursor.execute('INSERT INTO host_events (client_id, host_account, site, event_type, details, event_time, source) VALUES (?, ?, ?, ?, ?, ?, ?)', (cid, blogin, dom, 'domain_diff', json.dumps(details, ensure_ascii=False), now_ts, 'beget_diff'))
                            except Exception:
                                pass
                        # sites
                        prev_sites = set([s.get('name') or s.get('site') or s.get('path') for s in prev_snap.get('sites', []) if s])
                        curr_sites = set([s.get('name') or s.get('site') or s.get('path') for s in curr_snap.get('sites', []) if s])
                        for s in (curr_sites - prev_sites):
                            try:
                                details = {'action': 'created', 'site': s, 'detected_at': now_ts, 'prev_snapshot': prev_ts, 'curr_snapshot': curr_ts, 'method': 'snapshot_diff'}
                                cursor.execute('INSERT INTO host_events (client_id, host_account, site, event_type, details, event_time, source) VALUES (?, ?, ?, ?, ?, ?, ?)', (cid, blogin, s, 'site_diff', json.dumps(details, ensure_ascii=False), now_ts, 'beget_diff'))
                            except Exception:
                                pass
                        for s in (prev_sites - curr_sites):
                            try:
                                details = {'action': 'removed', 'site': s, 'detected_at': now_ts, 'prev_snapshot': prev_ts, 'curr_snapshot': curr_ts, 'method': 'snapshot_diff'}
                                cursor.execute('INSERT INTO host_events (client_id, host_account, site, event_type, details, event_time, source) VALUES (?, ?, ?, ?, ?, ?, ?)', (cid, blogin, s, 'site_diff', json.dumps(details, ensure_ascii=False), now_ts, 'beget_diff'))
                            except Exception:
                                pass
                        # databases
                        prev_dbs = set([d.get('name') for d in prev_snap.get('databases', []) if d and d.get('name')])
                        curr_dbs = set([d.get('name') for d in curr_snap.get('databases', []) if d and d.get('name')])
                        for dbn in (curr_dbs - prev_dbs):
                            try:
                                details = {'action': 'created', 'db': dbn, 'detected_at': now_ts, 'prev_snapshot': prev_ts, 'curr_snapshot': curr_ts, 'method': 'snapshot_diff'}
                                cursor.execute('INSERT INTO host_events (client_id, host_account, site, event_type, details, event_time, source) VALUES (?, ?, ?, ?, ?, ?, ?)', (cid, blogin, None, 'db_diff', json.dumps(details, ensure_ascii=False), now_ts, 'beget_diff'))
                            except Exception:
                                pass
                        for dbn in (prev_dbs - curr_dbs):
                            try:
                                details = {'action': 'removed', 'db': dbn, 'detected_at': now_ts, 'prev_snapshot': prev_ts, 'curr_snapshot': curr_ts, 'method': 'snapshot_diff'}
                                cursor.execute('INSERT INTO host_events (client_id, host_account, site, event_type, details, event_time, source) VALUES (?, ?, ?, ?, ?, ?, ?)', (cid, blogin, None, 'db_diff', json.dumps(details, ensure_ascii=False), now_ts, 'beget_diff'))
                            except Exception:
                                pass
                        # mailboxes
                        prev_mb = set()
                        curr_mb = set()
                        for b in prev_snap.get('mailboxes', []):
                            if isinstance(b, dict):
                                m = b.get('mailbox') or b.get('address') or None
                                fq = b.get('domain_fqdn') or b.get('domain') or None
                                if m and fq:
                                    prev_mb.add(f"{m}@{fq}")
                        for b in curr_snap.get('mailboxes', []):
                            if isinstance(b, dict):
                                m = b.get('mailbox') or b.get('address') or None
                                fq = b.get('domain_fqdn') or b.get('domain') or None
                                if m and fq:
                                    curr_mb.add(f"{m}@{fq}")
                        for m in (curr_mb - prev_mb):
                            try:
                                details = {'action': 'created', 'mailbox': m, 'detected_at': now_ts, 'prev_snapshot': prev_ts, 'curr_snapshot': curr_ts, 'method': 'snapshot_diff'}
                                cursor.execute('INSERT INTO host_events (client_id, host_account, site, event_type, details, event_time, source) VALUES (?, ?, ?, ?, ?, ?, ?)', (cid, blogin, None, 'mailbox_diff', json.dumps(details, ensure_ascii=False), now_ts, 'beget_diff'))
                            except Exception:
                                pass
                        for m in (prev_mb - curr_mb):
                            try:
                                details = {'action': 'removed', 'mailbox': m, 'detected_at': now_ts, 'prev_snapshot': prev_ts, 'curr_snapshot': curr_ts, 'method': 'snapshot_diff'}
                                cursor.execute('INSERT INTO host_events (client_id, host_account, site, event_type, details, event_time, source) VALUES (?, ?, ?, ?, ?, ?, ?)', (cid, blogin, None, 'mailbox_diff', json.dumps(details, ensure_ascii=False), now_ts, 'beget_diff'))
                            except Exception:
                                pass
                        conn.commit()
                except Exception:
                    pass
                print(f"[BEGET] client {cid}: snapshot saved and diffs applied")
            except Exception as e:
                print(f"[BEGET] error for client {cid}: {e}")
                try:
                    cursor.execute('INSERT INTO host_events (client_id, host_account, site, event_type, details, event_time, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                   (cid, blogin, None, 'beget_error', json.dumps({'error': str(e)}, ensure_ascii=False), now_ts, 'beget_error'))
                    conn.commit()
                except Exception:
                    pass
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

        req = urllib.request.urlopen(url, timeout=15, context=ssl_ctx)
        raw = req.read().decode('utf-8')
        try:
            data = json.loads(raw)
        except Exception:
            # Если ответ не в JSON — пробуем обернуть или записать как ошибку
            data = {"status": "error", "message": f"Invalid JSON response: {raw[:200]}"}

        if data.get('status') == 'ok':
            # Поддерживаем два варианта: старый — одиночный бэкап (date/filename/size_mb),
            # и новый — полный список файлов в поле 'files' или 'backups'.
            client_id = None
            try:
                cursor.execute('SELECT client_id FROM site_mapping WHERE site_domain = ?', (site_domain,))
                rmap = cursor.fetchone()
                if rmap:
                    client_id = rmap[0]
            except Exception:
                client_id = None

            # Helper to insert a backup record if not exists
            def insert_backup_record(site_name, site_url, site_domain, client_id, filename, backup_date, size_mb, detected_at, status, source, extra_json):
                try:
                    cursor.execute(
                        "SELECT id FROM backup_history WHERE site_domain = ? AND filename = ? AND backup_date = ?",
                        (site_domain, filename, backup_date)
                    )
                    exists = cursor.fetchone()
                    if not exists:
                        cursor.execute(
                            "INSERT INTO backup_history (site_name, site_url, site_domain, client_id, filename, backup_date, size_mb, detected_at, status, source, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            (site_name, site_url, site_domain, client_id, filename, backup_date, size_mb, detected_at, status, source, extra_json)
                        )
                        conn.commit()
                        print(f"[OK] {site_name} ({site_domain}) - saved backup {backup_date} / {size_mb} MB client_id={client_id} filename={filename}")
                    else:
                        # already recorded
                        pass
                except Exception as e:
                    print(f"[ERR] can't insert backup record: {e}")

            # If agent returned array of files/backups
            files_list = None
            if isinstance(data.get('files'), list):
                files_list = data.get('files')
            elif isinstance(data.get('backups'), list):
                files_list = data.get('backups')

            if files_list is not None:
                # Normalize current filenames set
                curr_filenames = set()
                for f in files_list:
                    try:
                        # support both dicts and simple strings
                        if isinstance(f, dict):
                            fname = f.get('filename') or f.get('name') or f.get('file')
                            # backup date: try mtime (unix) or date string
                            b_date_raw = f.get('mtime') or f.get('date') or f.get('backup_date')
                            # size
                            size_mb = f.get('size_mb') or (f.get('size') and round(float(f.get('size'))/1024/1024,2)) or None
                            checksum = f.get('checksum') or f.get('md5') or None
                        else:
                            fname = str(f)
                            b_date_raw = None
                            size_mb = None
                            checksum = None

                        if not fname:
                            continue

                        # normalize backup_date to string YYYY-MM-DD HH:MM:SS where possible
                        b_date = None
                        if b_date_raw:
                            try:
                                # if numeric — assume unix timestamp
                                if isinstance(b_date_raw, (int, float)) or (isinstance(b_date_raw, str) and b_date_raw.isdigit()):
                                    ts = int(b_date_raw)
                                    b_date = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')
                                else:
                                    # try parsing ISO-like
                                    b_date = str(b_date_raw)
                            except Exception:
                                b_date = str(b_date_raw)

                        curr_filenames.add(fname)
                        extra = {'checksum': checksum} if checksum else {}
                        if b_date is None:
                            # use now as backup_date if unknown
                            b_date = now_str

                        insert_backup_record(site_name, site_url, site_domain, client_id, fname, b_date, size_mb, now_str, 'ok', 'agent', json.dumps({'source_files_list_item': f}, ensure_ascii=False))
                    except Exception as e:
                        print(f"[WARN] processing file entry failed: {e}")

                # detect deletions: find previously known filenames for this site and mark removed if missing now
                try:
                    cursor.execute('SELECT DISTINCT filename FROM backup_history WHERE site_domain = ? AND filename IS NOT NULL AND filename != ""', (site_domain,))
                    prev = set([r[0] for r in cursor.fetchall()])
                    removed = prev - curr_filenames
                    for rf in removed:
                        try:
                            # get last seen date for that filename
                            cursor.execute('SELECT MAX(backup_date) FROM backup_history WHERE site_domain = ? AND filename = ?', (site_domain, rf))
                            last = cursor.fetchone()
                            last_date = last[0] if last and last[0] else None
                            # insert removed event
                            cursor.execute(
                                "INSERT INTO backup_history (site_name, site_url, site_domain, client_id, filename, backup_date, size_mb, detected_at, status, source, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                (site_name, site_url, site_domain, client_id, rf, last_date, None, now_str, 'removed', 'agent', json.dumps({'removed_detected': True}, ensure_ascii=False))
                            )
                            conn.commit()
                            print(f"[REMOVED] {site_name} ({site_domain}) - detected removed backup file: {rf}")
                        except Exception:
                            pass
                except Exception as e:
                    print(f"[WARN] failed to detect removed files: {e}")

            else:
                # Old single-backup agent behavior
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
