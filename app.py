from flask import Flask, render_template_string, request, redirect, url_for, jsonify, flash, session
from functools import wraps
from urllib.parse import quote, urlparse
import base64, hashlib, hmac, secrets
import saby_helper, inn_helper, crm_core, sqlite3, requests

app = Flask(__name__)
import os as _os
# Use environment variable FLASK_SECRET to secure session flash messages and session usage.
# In production please set a strong secret in systemd or environment. Default is a dev placeholder.
app.secret_key = _os.environ.get('FLASK_SECRET', 'dev-secret-change-me')

import os

def get_db():
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_data.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_access_tables():
    db = get_db()
    db.execute('''CREATE TABLE IF NOT EXISTS client_access_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at TEXT,
        revoked_at TEXT,
        FOREIGN KEY(client_id) REFERENCES clients(id)
    )''')
    db.execute('CREATE INDEX IF NOT EXISTS idx_client_access_links_client ON client_access_links(client_id)')
    db.commit()
    db.close()


def _token_hash(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _public_client_from_token(token):
    if not token or len(token) < 32:
        return None
    db = get_db()
    row = db.execute('''SELECT l.id AS link_id, l.client_id, c.company_name
                        FROM client_access_links l JOIN clients c ON c.id=l.client_id
                        WHERE l.token_hash=? AND l.revoked_at IS NULL''', (_token_hash(token),)).fetchone()
    if row:
        db.execute("UPDATE client_access_links SET last_used_at=CURRENT_TIMESTAMP WHERE id=?", (row['link_id'],))
        db.commit()
    db.close()
    return dict(row) if row else None


ensure_access_tables()

# Первый этап защиты CRM: credentials и внутренний токен хранятся вне кода,
# в root-only файлах рядом с приложением. Формат credentials:
# username\\nsalt_hex\\ndigest_hex\\nmust_change(0|1)\\n
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ADMIN_CREDENTIALS_FILE = os.environ.get('CRM_ADMIN_CREDENTIALS_FILE', os.path.join(BASE_DIR, '.admin_credentials'))
INTERNAL_TOKEN_FILE = os.environ.get('CRM_INTERNAL_TOKEN_FILE', os.path.join(BASE_DIR, '.internal_report_token'))
ADMIN_SESSION_KEY = 'crm_admin_user'


def _read_lines(path):
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            return [line.rstrip('\n') for line in fh]
    except OSError:
        return []


def _load_admin_credentials():
    lines = _read_lines(ADMIN_CREDENTIALS_FILE)
    if len(lines) < 4:
        return None
    return {'username': lines[0], 'salt': lines[1], 'digest': lines[2], 'must_change': lines[3] == '1'}


def _verify_password(password, record):
    try:
        digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(record['salt']), 210000)
        return hmac.compare_digest(digest.hex(), record['digest'])
    except (ValueError, TypeError):
        return False


def _internal_token_valid():
    expected = ''.join(_read_lines(INTERNAL_TOKEN_FILE)).strip()
    supplied = request.headers.get('X-CRM-Internal-Token', '')
    return bool(expected) and hmac.compare_digest(expected, supplied)


def _admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get(ADMIN_SESSION_KEY):
            next_url = request.full_path.rstrip('?')
            return redirect('/login?next=' + quote(next_url))
        return view(*args, **kwargs)
    return wrapped


@app.before_request
def protect_admin_routes():
    # Login and health check remain public. Public client cabinets will use
    # their own token route in the next migration and will not enter here.
    if request.endpoint in {'login', 'healthz'} or request.path.startswith('/public/'):
        return None
    # The scheduled report sender authenticates with a root-only token rather
    # than exposing the administrative session to a background process.
    if request.path.endswith('/report') and _internal_token_valid():
        return None
    if request.path.endswith('/report') and _public_client_from_token(request.args.get('access_token')):
        return None
    if session.get(ADMIN_SESSION_KEY):
        return None
    return redirect('/login?next=' + quote(request.full_path.rstrip('?')))


@app.route('/healthz')
def healthz():
    return jsonify({'status': 'ok'})


@app.route('/login', methods=['GET', 'POST'])
def login():
    record = _load_admin_credentials()
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        if record and hmac.compare_digest(username.lower(), record['username'].lower()) and _verify_password(password, record):
            session.clear()
            session[ADMIN_SESSION_KEY] = record['username']
            session.permanent = True
            next_url = request.args.get('next', '/')
            parsed = urlparse(next_url)
            if parsed.scheme or parsed.netloc or not next_url.startswith('/'):
                next_url = '/'
            if record['must_change']:
                return redirect('/change-password')
            return redirect(next_url)
        error = 'Неверный логин или пароль.'
    return render_template_string('''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход в CRM</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#f5f7fb,#eef1f7);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#20242c}.card{width:min(420px,calc(100% - 32px));padding:32px;border:1px solid rgba(255,255,255,.75);border-radius:28px;background:rgba(255,255,255,.72);box-shadow:0 20px 60px rgba(37,45,65,.14);backdrop-filter:blur(18px)}h1{margin-top:0;font-size:28px}label{display:block;margin:16px 0 6px;color:#626b7d}input{width:100%;box-sizing:border-box;padding:13px 14px;border:1px solid #d8deea;border-radius:12px;font-size:16px}button{margin-top:22px;width:100%;padding:13px;border:0;border-radius:12px;background:#202b45;color:#fff;font-size:16px;font-weight:700;cursor:pointer}.error{padding:10px 12px;background:#fff0f0;border:1px solid #ffcaca;border-radius:10px;color:#a12626}</style></head><body><main class="card"><h1>Вход в CRM</h1><p>Защищённое рабочее пространство администратора.</p>{% if error %}<div class="error">{{ error }}</div>{% endif %}<form method="post"><label for="username">Логин</label><input id="username" name="username" autocomplete="username" required><label for="password">Пароль</label><input id="password" type="password" name="password" autocomplete="current-password" required><button type="submit">Войти</button></form></main></body></html>''', error=error)


@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')


@app.route('/change-password', methods=['GET', 'POST'])
def change_password():
    if not session.get(ADMIN_SESSION_KEY):
        return redirect('/login?next=/change-password')
    record = _load_admin_credentials()
    error = None
    message = None
    if request.method == 'POST':
        current = request.form.get('current_password', '')
        new_password = request.form.get('new_password', '')
        confirm = request.form.get('confirm_password', '')
        if not record or not _verify_password(current, record):
            error = 'Текущий пароль указан неверно.'
        elif not new_password:
            error = 'Новый пароль не может быть пустым.'
        elif new_password != confirm:
            error = 'Новые пароли не совпадают.'
        else:
            salt = secrets.token_bytes(16)
            digest = hashlib.pbkdf2_hmac('sha256', new_password.encode('utf-8'), salt, 210000).hex()
            with open(ADMIN_CREDENTIALS_FILE, 'w', encoding='utf-8') as fh:
                fh.write(f"{record['username']}\n{salt.hex()}\n{digest}\n0\n")
            os.chmod(ADMIN_CREDENTIALS_FILE, 0o600)
            session[ADMIN_SESSION_KEY] = record['username']
            session.permanent = True
            return redirect('/')
    return render_template_string('''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Смена пароля</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(460px,calc(100% - 32px));padding:32px;background:#fff;border-radius:24px;box-shadow:0 18px 50px #24314d18}label{display:block;margin:14px 0 6px}input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #d8deea;border-radius:10px;font-size:16px}button{margin-top:20px;width:100%;padding:12px;border:0;border-radius:10px;background:#202b45;color:#fff;font-weight:700}.error{color:#a12626}.ok{color:#176b3b}</style></head><body><main class="card"><h1>Смена пароля</h1>{% if error %}<p class="error">{{ error }}</p>{% endif %}{% if message %}<p class="ok">{{ message }}</p>{% endif %}<form method="post"><label>Текущий пароль</label><input type="password" name="current_password" required><label>Новый пароль</label><input type="password" name="new_password" required><label>Повторите новый пароль</label><input type="password" name="confirm_password" required><button type="submit">Сохранить новый пароль</button></form></main></body></html>''', error=error, message=message)

INDEX_TEMPLATE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Saby & Beget CRM - Климов Евгений</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg,#fffaf0 0%, #ffffff 100%); min-height: 100vh; color: #2b2f2f; padding: 25px; margin: 0; }
        .container { max-width: 1000px; margin: auto; background: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 6px 18px rgba(43,45,48,0.04); }
        h2 { color: #6b5a57; border-bottom: 1px solid #f0e9e6; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 10px; border: 1px solid #f0e9e6; text-align: left; font-size: 14px; }
        th { background: #f8f4f3; color: #6b5a57; }
        a { color: #6b5a57; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .btn { background: linear-gradient(135deg,#ffd6c2 0%, #ffb4a2 100%); color: #2b2f2f; padding: 10px 18px; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; transition: all 0.15s ease; box-shadow: 0 6px 12px rgba(255,180,162,0.12); }
        .btn:hover { filter: brightness(0.97); }
    </style>
</head>
<body>
    <div class="container">
        <h2>CRM-система управления инфраструктурой сайтов и договоров</h2>
        <div style="margin-bottom: 20px;">
            <a href="/add_page" class="btn" style="display:inline-block;">+ Добавить контрагента из Saby</a>
        </div>
        <table>
            <tr>
                <th>Компания / ИНН</th>
                <th>Договор Saby</th>
                <th>Сайты</th>
                <th>Beget Логин</th>
                <th>Действия</th>
            </tr>
            {% for c in clients %}
            <tr>
                <td><strong>{{ c.company_name }}</strong><br><small style="color:#94a3b8;">ИНН: {{ c.inn }}</small></td>
                <td>{{ c.saby_contract_number }}</td>
                <td>{{ c.sites }}</td>
                <td>{{ c.beget_login or 'Не задан' }}</td>
                <td><a href="/client/{{ c.id }}">Открыть карточку / Отчеты</a></td>
            </tr>
            {% endfor %}
        </table>
    </div>
</body>
</html>
"""

ADD_TEMPLATE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Добавление контрагента</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg,#fffaf0 0%, #ffffff 100%); min-height: 100vh; color: #2b2f2f; padding: 25px; margin: 0; }
        .container { max-width: 700px; margin: auto; background: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 6px 18px rgba(43,45,48,0.04); }
        .form-group { margin-bottom: 15px; position: relative; }
        input, select { width: 100%; padding: 10px; box-sizing: border-box; background: #ffffff; border: 1px solid #f0e9e6; color: #2b2f2f; border-radius: 6px; }
        button { background: linear-gradient(135deg,#ffd6c2 0%, #ffb4a2 100%); color: #2b2f2f; padding: 10px 15px; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; box-shadow: 0 6px 12px rgba(255,180,162,0.08); }
        a { color: #6b5a57; }
        .suggest-item { padding: 10px; cursor: pointer; border-bottom: 1px solid #f0e9e6; background: #fff; }
        .suggest-item:hover { background: #fff6f3; }
    </style>
    <script>
        let searchTimer = null;
        function searchCompany() {
            clearTimeout(searchTimer);
            const q = document.getElementById('search_input').value;
            const box = document.getElementById('suggest-box');
            if (q.length < 2) { box.style.display = 'none'; return; }
            searchTimer = setTimeout(() => {
                fetch('/suggest_company?q=' + encodeURIComponent(q))
                    .then(r => r.json())
                    .then(items => {
                        box.innerHTML = '';
                        if(items.length > 0) {
                            box.style.display = 'block';
                            items.forEach(i => {
                                const div = document.createElement('div');
                                div.className = 'suggest-item';
                                div.innerHTML = '<strong>' + i.name + '</strong> (ИНН: ' + i.inn + ')';
                                div.onclick = () => {
                                    document.getElementById('search_input').value = i.name;
                                    document.getElementById('inn').value = i.inn;
                                    document.getElementById('company_name').value = i.name;
                                    box.style.display = 'none';
                                    loadContracts(i.inn);
                                };
                                box.appendChild(div);
                            });
                        } else { box.style.display = 'none'; }
                    });
            }, 300);
        }

        function loadContracts(inn) {
            fetch('/get_contracts?inn=' + inn)
                .then(r => r.json())
                .then(data => {
                    const sel = document.getElementById('contract_select');
                    sel.innerHTML = '<option value="">-- Выберите договор из Saby --</option>';
                    if(data.contracts) {
                        data.contracts.forEach(c => {
                            const opt = document.createElement('option');
                            opt.value = c.id + '|||' + c.number + '|||' + c.title;
                            opt.textContent = '№ ' + c.number + ' | ' + c.title;
                            sel.appendChild(opt);
                        });
                    }
                });
        }

        function onContractChange() {
            const val = document.getElementById('contract_select').value;
            const parts = val.split('|||');
            document.getElementById('contract_id').value = parts[0] || '';
            document.getElementById('contract_number').value = parts[1] || '';
        }
    </script>
</head>
<body>
    <div class="container">
        <h2>Добавление контрагента из Saby</h2>
        <form action="/add_client" method="POST">
            <input type="hidden" id="inn" name="inn">
            <input type="hidden" id="company_name" name="company_name">
            <input type="hidden" id="contract_id" name="contract_id">
            <input type="hidden" id="contract_number" name="contract_number">

            <div class="form-group">
                <label>Поиск компании (ИНН / Название):</label>
                <input type="text" id="search_input" placeholder="Введите ИНН..." oninput="searchCompany()" autocomplete="off">
                <div id="suggest-box" style="position:absolute; left:0; right:0; max-height:180px; overflow-y:auto; border:1px solid #475569; display:none; z-index:10;"></div>
            </div>

            <div class="form-group">
                <label>Договор из Saby:</label>
                <select id="contract_select" onchange="onContractChange()">
                    <option value="">Сначала выберите организацию выше</option>
                </select>
            </div>

            <div class="form-group">
                <label>Сайты:</label>
                <input type="text" name="sites" placeholder="site.ru">
            </div>

            <div class="form-group">
                <label>Email для отчетов:</label>
                <input type="text" name="emails" placeholder="client@mail.ru">
            </div>

            <button type="submit">Сохранить</button>
            <p><a href="/">Назад</a></p>
        </form>
    </div>
</body>
</html>
"""

CLIENT_CARD_TEMPLATE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Карточка: {{ client.company_name }}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg,#fffaf0 0%, #ffffff 100%); min-height: 100vh; color: #2b2f2f; padding: 25px; margin: 0; }
        .container { max-width: 950px; margin: auto; background: #ffffff; padding: 25px; border-radius: 8px; }
        h2, h3 { color: #6b5a57; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .box { background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #f0e9e6; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px; border: 1px solid #f0e9e6; text-align: left; font-size: 13px; }
        th { background: #f8f4f3; color: #6b5a57; }
        input, textarea { width: 100%; padding: 8px; box-sizing: border-box; background: #fff; border: 1px solid #f0e9e6; color: #2b2f2f; border-radius: 6px; margin-top: 5px; }
        button, .btn-link { background: linear-gradient(135deg,#ffd6c2 0%, #ffb4a2 100%); color: #2b2f2f; padding: 8px 14px; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; margin-top: 10px; text-decoration:none; display:inline-block; box-shadow: 0 6px 12px rgba(255,180,162,0.08); }
        button:hover, .btn-link:hover { filter: brightness(0.98); }
        a { color: #6b5a57; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/">&larr; Назад к списку</a>
        <h2>{{ client.company_name }}</h2>
        
        <div class="grid">
            <div class="box">
                <h3>Реквизиты и договор Saby</h3>
                <p><strong>ИНН:</strong> {{ client.inn }}</p>
                <p><strong>Договор:</strong> № {{ client.saby_contract_number }}</p>
                <p><strong>Сайты:</strong> {{ client.sites }}</p>
                <p><strong>Email:</strong> {{ client.emails }}</p>
            </div>

            <div class="box">
                <h3>Доступы Beget (Хостинг / Почта / Домены)</h3>
                <form action="/client/{{ client.id }}/update_beget" method="POST">
                    <label>Логин Beget:</label>
                    <input type="text" name="beget_login" value="{{ client.beget_login or '' }}">
                    <label>Пароль Beget:</label>
                    <input type="password" name="beget_pass" value="{{ client.beget_pass or '' }}">
                    <label>API-ключ Beget (если есть):</label>
                    <input type="text" name="beget_api_key" value="{{ client.beget_api_key or '' }}">
                    <label>Сайты:</label>
                    <input type="text" name="sites" value="{{ client.sites or '' }}">
                    <label>Email (через запятую):</label>
                    <input type="text" name="emails" value="{{ client.email_reports or client.emails or '' }}">
                    <label>Периодичность рассылки отчёта:</label>
                    <select name="report_schedule">
                        <option value="none" {% if (client.report_schedule or '') == 'none' %}selected{% endif %}>Не рассылать</option>
                        <option value="daily" {% if (client.report_schedule or '') == 'daily' %}selected{% endif %}>Ежедневно (за вчера)</option>
                        <option value="weekly" {% if (client.report_schedule or '') == 'weekly' %}selected{% endif %}>Еженедельно (по понедельникам — за прошлую неделю)</option>
                        <option value="monthly" {% if (client.report_schedule or '') == 'monthly' %}selected{% endif %}>Ежемесячно (1 раз в месяц — за предыдущий месяц)</option>
                    </select>
                    <label style="display:block; margin-top:8px;">День старта отчётов (1-28):</label>
                    <input type="number" min="1" max="28" name="report_start_day" value="{{ client.report_start_day or '' }}">
                    <div style="margin-top:8px;">
                        <label style="font-weight:bold; display:block;">Выбор данных для включения в автоматический отчет:</label>
                        <label><input type="checkbox" name="report_sections" value="backups" {% if 'backups' in (client.report_sections or '') %}checked{% endif %}> Резервные копии (включая 1С-Битрикс)</label><br>
                        <label><input type="checkbox" name="report_sections" value="host_events" {% if 'host_events' in (client.report_sections or '') %}checked{% endif %}> События хостинга (домены, сайты, БД)</label><br>
                        <label><input type="checkbox" name="report_sections" value="mailboxes" {% if 'mailboxes' in (client.report_sections or '') %}checked{% endif %}> Почтовые ящики (создание/удаление)</label><br>
                        <label><input type="checkbox" name="report_sections" value="account" {% if 'account' in (client.report_sections or '') %}checked{% endif %}> Информация об аккаунте / баланс</label><br>
                        <label><input type="checkbox" name="report_sections" value="certs" {% if 'certs' in (client.report_sections or '') %}checked{% endif %}> Состояние сертификатов / продления</label>
                    </div>
                    <button type="submit" style="margin-top:10px;">Сохранить доступы</button>
                </form>
            </div>
        </div>

        <div style="margin-top: 25px;" class="box">
            <h3>Клиентский кабинет</h3>
            <p>Создайте отзывную ссылку, по которой клиент сможет выбрать период и самостоятельно сформировать отчёт без доступа к рабочему пространству.</p>
            <form action="/client/{{ client.id }}/create-access-link" method="POST"><button type="submit">Создать новую ссылку кабинета</button></form>
        </div>

        <div style="margin-top: 25px;" class="box">
            <h3>Генерация отчета и мониторинг</h3>
            <p>Выберите период для формирования отчета со списком выполненных работ, бэкапов (включая 1С-Битрикс), состоянием доменов, почты и баланса хостинга.</p>
            <form action="/client/{{ client.id }}/report" method="GET" style="display: flex; gap: 10px; align-items: flex-end; margin-top: 10px;" target="_blank" onsubmit="return openReportTab(this)">
                <div style="flex: 1;">
                    <label style="font-size: 13px;">Дата с:</label>
                    <input type="date" name="date_from" value="{{ default_date_from }}" style="margin-top:5px; padding:8px; background:#ffffff; border:1px solid #f0e9e6; color:#2b2f2f; border-radius:4px; width:100%;">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 13px;">Дата по:</label>
                    <input type="date" name="date_to" value="{{ default_date_to }}" style="margin-top:5px; padding:8px; background:#ffffff; border:1px solid #f0e9e6; color:#2b2f2f; border-radius:4px; width:100%;">
                </div>
                <div>
                    <button type="submit" class="btn-link" style="margin-top: 0; padding: 10px 14px;">Сформировать отчет</button>
                    <button type="button" onclick="setPrevMonth()" class="btn-link" style="margin-left:8px; padding:10px 12px;">Прошлый месяц</button>
                    <button type="button" onclick="setThisMonth()" class="btn-link" style="margin-left:8px; padding:10px 12px;">Текущий месяц</button>
                    <button type="button" onclick="setLast7Days()" class="btn-link" style="margin-left:8px; padding:10px 12px;">Последние 7 дней</button>
                </div>
            </form>
            <script>
                function openReportTab(form) {
                    const url = form.action + '?' + new URLSearchParams(new FormData(form)).toString();
                    const w = window.open('', '_blank');
                    if (!w) { alert('Разрешите всплывающие окна для этого сайта'); return false; }
                    w.document.write('<html><head><meta charset="utf-8"><title>Формирование отчёта...</title></head><body style="font-family:sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f7fa;"><h2 style="color:#333;">⏳ Формирование отчёта...</h2><p style="color:#666;">Идёт сбор данных с хостинга Beget, пожалуйста, подождите.</p><svg width="50" height="50" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke="#3498db" stroke-width="5" stroke-dasharray="80"><animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/></circle></svg></body></html>');
                    w.document.close();
                    fetch(url).then(function(r){ return r.text(); }).then(function(html){
                        w.document.open(); w.document.write(html); w.document.close();
                    }).catch(function(e){
                        w.document.body.innerHTML = '<h2 style="color:#c0392b;text-align:center;">Ошибка загрузки отчёта: ' + e + '</h2>';
                    });
                    return false;
                }
                function showReportLoader() {
                    const overlay = document.createElement('div');
                    overlay.id = 'report-loader-overlay';
                    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.95);z-index:9999;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:sans-serif;';
                    overlay.innerHTML = '<h2 style="color:#333;margin-bottom:10px;">⏳ Формирование отчёта...</h2><p style="color:#666;">Пожалуйста, подождите (до 30 сек).<br>Идёт сбор и сжатие данных.</p><div style="margin-top:20px;"><svg width="40" height="40" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke="#ffb4a2" stroke-width="5" stroke-dasharray="80" stroke-dashoffset="0"><animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/></circle></svg></div>';
                    document.body.appendChild(overlay);
                }
                function fmtY(d){ return d.toISOString().slice(0,10); }
                function setPrevMonth(){
                    const now = new Date();
                    const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const lastMonthEnd = new Date(firstThisMonth.getTime() - 1);
                    const from = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
                    const to = lastMonthEnd;
                    document.querySelector('input[name="date_from"]').value = fmtY(from);
                    document.querySelector('input[name="date_to"]').value = fmtY(to);
                }
                function setThisMonth(){
                    const now = new Date();
                    const from = new Date(now.getFullYear(), now.getMonth(), 1);
                    document.querySelector('input[name="date_from"]').value = fmtY(from);
                    document.querySelector('input[name="date_to"]').value = fmtY(new Date());
                }
                function setLast7Days(){
                    const now = new Date();
                    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()-6);
                    document.querySelector('input[name="date_from"]').value = fmtY(from);
                    document.querySelector('input[name="date_to"]').value = fmtY(new Date());
                }
            </script>
        </div>

        <h3 style="margin-top:25px;">Учет выполненных работ и обращений</h3>
        <table>
            <tr><th>Дата / время</th><th>Описание работ / бэкапов / инцидентов</th><th>Часы</th><th>Действия</th></tr>
            {% for log in logs %}
            <tr>
                <td>{{ log.work_date_rus or log.work_date }}</td>
                <td>{{ log.description }}</td>
                <td>{{ log.hours }} ч.</td>
                <td>
                    <a href="/client/{{ client.id }}/edit_log/{{ log.id }}" style="color:#38bdf8;">Редактировать</a> |
                    <a href="/client/{{ client.id }}/delete_log/{{ log.id }}" style="color:#f97316;" onclick="return confirm('Удалить запись?');">Удалить</a>
                </td>
            </tr>
            {% else %}
            <tr><td colspan="4" style="text-align:center; color:#94a3b8;">Нет записей</td></tr>
            {% endfor %}
        </table>

        <form action="/client/{{ client.id }}/add_log" method="POST" style="margin-top:15px;" class="box">
            <h4>Добавить запись о работах</h4>
            <label>Дата и время (оставьте пустым для текущей даты):</label>
            <input type="datetime-local" name="work_date_local" value="">
            <textarea name="description" rows="2" placeholder="Например: Штатный бэкап, создание почтового ящика info@site.ru..." required></textarea>
            <label style="margin-top:10px; display:block;">Часы:</label>
            <input type="number" step="0.5" name="hours" value="1.0" required style="width: 100px;">
            <button type="submit">Добавить запись</button>
        </form>

        <h3 style="margin-top:25px;">Непрерывная лента (работы / бэкапы / события хостинга)</h3>
        <div class="box">
        {% if timeline and timeline|length > 0 %}
            <table>
                <tr><th>Время</th><th>Тип</th><th>Описание</th></tr>
                {% for e in timeline %}
                    <tr>
                        <td>{{ e.human or '' }}</td>
                        <td>{{ e.type }}</td>
                        <td>
                            {% if e.type == 'work_log' %}
                                {{ e.description }} ({{ e.hours }} ч.)
                            {% elif e.type == 'backup' %}
                                Бэкап: {{ e.site_name or e.site_domain }} — {{ e.status }} — {{ e.size_mb or 'N/A' }} МБ
                            {% elif e.type == 'host_event' %}
                                {{ e.event_type }} — (детали события скрыты для компактности)
                            {% else %}
                                {{ e }}
                            {% endif %}
                        </td>
                    </tr>
                {% endfor %}
            </table>
        {% else %}
            <p style="color:#94a3b8;">Лента пуста.</p>
        {% endif %}
        </div>
    </div>
</body>
</html>
"""

REPORT_TEMPLATE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Отчёт {{ client.company_name or 'Клиент' }}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; color: #333; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #2980b9; margin-top: 30px; border-left: 4px solid #3498db; padding-left: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #3498db; color: white; font-weight: bold; }
        tr:nth-child(even) { background: #f9f9f9; }
        .summary { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .summary p { margin: 8px 0; font-size: 15px; }
        .no-data { color: #7f8c8d; font-style: italic; text-align: center; padding: 20px; }
        .btn { padding: 12px 24px; font-size: 16px; cursor: pointer; border: none; border-radius: 5px; margin-right: 10px; color: white; }
        .btn-print { background: #27ae60; }
        .btn-close { background: #95a5a6; }
        @media print {
            .no-print { display: none; }
            body { margin: 0; padding: 10px; }
            table { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="no-print">
        <button onclick="window.print()" class="btn btn-print">🖨️ Печать / Сохранить PDF</button>
        <button onclick="window.close()" class="btn btn-close">✖ Закрыть</button>
    </div>
    
    <h1>Отчёт о сопровождении ИТ-инфраструктуры</h1>
    
    <div class="summary">
        <p><strong>Заказчик:</strong> {{ client.company_name or 'Не указано' }} (ИНН: {{ client.inn or 'Н/Д' }})</p>
        <p><strong>Договор:</strong> № {{ client.saby_contract_number or client.contract or 'Н/Д' }}</p>
        <p><strong>Период отчёта:</strong> с {{ date_from }} по {{ date_to }}</p>
        <p><strong>Дата формирования:</strong> {{ moment().format('DD.MM.YYYY HH:mm') if moment else 'сейчас' }}</p>
    </div>
    
    <h2>💰 Баланс аккаунта Beget (на дату формирования)</h2>
    <p style="font-size: 18px; font-weight: bold; color: {% if balance != 'Н/Д' %}#27ae60{% else %}#e74c3c{% endif %};">
        {{ balance }}
    </p>
    
    <h2>🌐 Домены и SSL-сертификаты</h2>
    {% if domains %}
    <table>
        <thead>
            <tr>
                <th>Домен</th>
                <th>Статус SSL</th>
                <th>Срок продления домена</th>
            </tr>
        </thead>
        <tbody>
            {% for domain in domains %}
            <tr>
                <td><strong>{{ domain.domain }}</strong></td>
                <td>{{ domain.ssl }}</td>
                <td>{{ domain.expire }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
    {% else %}
    <p class="no-data">Нет данных о доменах в последнем снимке хостинга</p>
    {% endif %}
    
    <h2>💾 Резервные копии хостинга ({{ backups|length }} шт.)</h2>
    {% if backups %}
    <table>
        <thead>
            <tr>
                <th>Сайт / Источник</th>
                <th>Дата и время бэкапа</th>
                <th>Размер</th>
            </tr>
        </thead>
        <tbody>
            {% for backup in backups %}
            <tr>
                <td>{{ backup.site_name or backup.site_domain or 'Неизвестно' }}</td>
                <td>{{ backup.backup_date }}</td>
                <td>{% if backup.size_mb %}{{ backup.size_mb }} МБ{% else %}—{% endif %}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
    {% else %}
    <p class="no-data">Бэкапы за выбранный период отсутствуют</p>
    {% endif %}
    
    <h2>📋 Выполненные работы и обращения ({{ logs|length }} шт.)</h2>
    {% if logs %}
    <table>
        <thead>
            <tr>
                <th>Дата выполнения</th>
                <th>Описание работы</th>
                <th>Затрачено часов</th>
            </tr>
        </thead>
        <tbody>
            {% for log in logs %}
            <tr>
                <td>{{ log.work_date }}</td>
                <td>{{ log.description }}</td>
                <td style="text-align: center;">{{ log.hours }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
    {% else %}
    <p class="no-data">Работы за выбранный период не зафиксированы</p>
    {% endif %}
    
    <div class="no-print" style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee;">
        <button onclick="window.print()" class="btn btn-print">🖨️ Печать / Сохранить PDF</button>
        <button onclick="window.close()" class="btn btn-close">✖ Закрыть</button>
    </div>
</body>
</html>
"""

@app.route('/')
def index():
    db = get_db()
    clients = db.execute('SELECT * FROM clients').fetchall()
    return render_template_string(INDEX_TEMPLATE, clients=clients)

@app.route('/add_page')
def add_page():
    return render_template_string(ADD_TEMPLATE)

@app.route('/suggest_company')
def suggest():
    return jsonify(inn_helper.suggest_company(request.args.get('q', '')))

@app.route('/get_contracts')
def get_contracts():
    inn = request.args.get('inn', '')
    contracts, _, _ = saby_helper.get_saby_contract_data(inn)
    return jsonify({"contracts": contracts})

@app.route('/add_client', methods=['POST'])
def add_client_post():
    crm_core.add_client(
        request.form.get('inn'),
        request.form.get('company_name'),
        request.form.get('emails'),
        request.form.get('sites'),
        request.form.get('contract_id'),
        request.form.get('contract_number')
    )
    return redirect(url_for('index'))

@app.route('/public/client/<token>')
def public_client_portal(token):
    access = _public_client_from_token(token)
    if not access:
        return 'Ссылка недействительна или отозвана', 404
    db = get_db()
    client = db.execute('SELECT id, company_name, inn, contract, sites FROM clients WHERE id=?', (access['client_id'],)).fetchone()
    db.close()
    if not client:
        return 'Клиент не найден', 404
    
    # Build timeline for this client (same logic as in client_card)
    import datetime
    today = datetime.date.today()
    first = today.replace(day=1)
    
    # Get timeline data
    timeline = []
    logs = []
    try:
        db2 = get_db()
        raw_logs = db2.execute('SELECT * FROM work_logs WHERE client_id = ? ORDER BY work_date DESC', (access['client_id'],)).fetchall()
        for r in raw_logs:
            row = dict(r)
            wd = row.get('work_date')
            wd_rus = wd
            try:
                if wd and len(wd) >= 10:
                    try:
                        dt = datetime.datetime.fromisoformat(wd)
                    except Exception:
                        dt = datetime.datetime.strptime(wd[:10], '%Y-%m-%d')
                    wd_rus = dt.strftime('%d.%m.%Y %H:%M')
            except Exception:
                wd_rus = wd
            row['work_date_rus'] = wd_rus
            logs.append(row)
        
        # Get host_events and backup_history from backups.db
        import os, json as _json, time as _time
        db_path_backups = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups.db')
        if os.path.exists(db_path_backups):
            conn_b = sqlite3.connect(db_path_backups)
            conn_b.row_factory = sqlite3.Row
            cur_b = conn_b.cursor()
            # host_events
            cur_b.execute('SELECT * FROM host_events WHERE client_id = ? ORDER BY event_time DESC LIMIT 500', (access['client_id'],))
            for r in cur_b.fetchall():
                try:
                    details = _json.loads(r['details']) if r['details'] else None
                except Exception:
                    details = r['details']
                ts = r['event_time'] or int(_time.time())
                human = None
                try:
                    human = datetime.datetime.fromtimestamp(ts).strftime('%d.%m.%Y %H:%M:%S')
                except Exception:
                    human = None
                timeline.append({'type': 'host_event', 'ts': ts, 'human': human, 'source': r['source'], 'event_type': r['event_type'], 'details': details})
            # backups
            cur_b.execute('SELECT site_name, site_domain, backup_date, size_mb, status, extra FROM backup_history WHERE client_id = ? ORDER BY backup_date DESC LIMIT 500', (access['client_id'],))
            for r in cur_b.fetchall():
                bd = r['backup_date']
                ts = None
                try:
                    ts = int(datetime.datetime.fromisoformat(bd).timestamp()) if bd else None
                except Exception:
                    try:
                        ts = int(datetime.datetime.strptime(bd[:19], '%Y-%m-%d %H:%M:%S').timestamp())
                    except Exception:
                        ts = None
                if not ts:
                    ts = int(_time.time())
                human = None
                try:
                    human = datetime.datetime.fromtimestamp(ts).strftime('%d.%m.%Y %H:%M:%S')
                except Exception:
                    human = bd
                timeline.append({'type': 'backup', 'ts': ts, 'human': human, 'site_name': r['site_name'], 'site_domain': r['site_domain'], 'size_mb': r['size_mb'], 'status': r['status'], 'extra': r['extra']})
            conn_b.close()
        
        # include work_logs
        for w in logs:
            ts = None
            try:
                ts = int(datetime.datetime.fromisoformat(w.get('work_date')).timestamp())
            except Exception:
                try:
                    ts = int(datetime.datetime.strptime(w.get('work_date')[:19], '%Y-%m-%d %H:%M:%S').timestamp())
                except Exception:
                    ts = int(_time.time())
            timeline.append({'type': 'work_log', 'ts': ts, 'human': w.get('work_date_rus'), 'description': w.get('description'), 'hours': w.get('hours')})
        
        # sort timeline by timestamp desc
        timeline = sorted(timeline, key=lambda x: x.get('ts', 0), reverse=True)
        db2.close()
    except Exception as e:
        print('Error building timeline for portal:', e)
    
    # Default dates for report form
    default_date_from = first.isoformat()
    default_date_to = today.isoformat()
    
    return render_template('client_portal.html', 
                          client=dict(client), 
                          token=token, 
                          access_token=token,
                          timeline=timeline,
                          default_date_from=default_date_from,
                          default_date_to=default_date_to,
                          reports=[])


@app.route('/client/<int:client_id>/create-access-link', methods=['POST'])
def create_access_link(client_id):
    db = get_db()
    client = db.execute('SELECT id, company_name FROM clients WHERE id=?', (client_id,)).fetchone()
    if not client:
        db.close()
        return 'Клиент не найден', 404
    token = secrets.token_urlsafe(32)
    db.execute('UPDATE client_access_links SET revoked_at=CURRENT_TIMESTAMP WHERE client_id=? AND revoked_at IS NULL', (client_id,))
    db.execute('INSERT INTO client_access_links(client_id, token_hash) VALUES (?, ?)', (client_id, _token_hash(token)))
    db.commit()
    db.close()
    link = 'https://' + request.host + '/public/client/' + token
    return render_template_string('''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ссылка создана</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(700px,calc(100% - 32px));padding:32px;background:#fff;border-radius:24px;box-shadow:0 18px 50px #24314d18}input{width:100%;box-sizing:border-box;padding:13px;border:1px solid #d8deea;border-radius:10px;font-size:15px}a{display:inline-block;margin-top:18px;color:#202b45}</style></head><body><main class="card"><h1>Ссылка создана</h1><p>Ссылка для {{ company_name }} активна. Скопируйте её и передайте клиенту. Предыдущая ссылка отозвана.</p><input readonly value="{{ link }}" onclick="this.select()"><p><a href="/client/{{ client_id }}">Вернуться в карточку клиента</a></p></main></body></html>''', company_name=client['company_name'], link=link, client_id=client_id)


@app.route('/client/<int:client_id>')
def client_card(client_id):
    db = get_db()
    row = db.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    client = dict(row) if row else {}
    raw_logs = db.execute('SELECT * FROM work_logs WHERE client_id = ? ORDER BY work_date DESC', (client_id,)).fetchall()
    # format logs with russian-friendly date
    logs = []
    import datetime as _dt
    for r in raw_logs:
        row = dict(r)
        wd = row.get('work_date')
        wd_rus = wd
        try:
            if wd and len(wd) >= 10:
                # try parse possible ISO or YYYY-MM-DD
                try:
                    dt = _dt.datetime.fromisoformat(wd)
                except Exception:
                    # fallback to date only
                    dt = _dt.datetime.strptime(wd[:10], '%Y-%m-%d')
                wd_rus = dt.strftime('%d.%m.%Y %H:%M')
        except Exception:
            wd_rus = wd
        row['work_date_rus'] = wd_rus
        logs.append(row)

    # default dates: previous month
    import datetime
    today = datetime.date.today()
    first_this_month = today.replace(day=1)
    last_month_end = first_this_month - datetime.timedelta(days=1)
    default_date_from = last_month_end.replace(day=1).strftime('%Y-%m-%d')
    default_date_to = last_month_end.strftime('%Y-%m-%d')

    # Build continuous timeline: combine work_logs, host_events and backup_history for the client (last 90 days)
    timeline = []
    try:
        import os, json as _json, time as _time
        db_path_backups = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups.db')
        if os.path.exists(db_path_backups):
            conn_b = sqlite3.connect(db_path_backups)
            conn_b.row_factory = sqlite3.Row
            cur_b = conn_b.cursor()
            # host_events
            cur_b.execute('SELECT * FROM host_events WHERE client_id = ? ORDER BY event_time DESC LIMIT 500', (client_id,))
            for r in cur_b.fetchall():
                try:
                    details = _json.loads(r['details']) if r['details'] else None
                except Exception:
                    details = r['details']
                ts = r['event_time'] or int(_time.time())
                human = None
                try:
                    human = datetime.datetime.fromtimestamp(ts).strftime('%d.%m.%Y %H:%M:%S')
                except Exception:
                    human = None
                timeline.append({'type': 'host_event', 'ts': ts, 'human': human, 'source': r['source'], 'event_type': r['event_type'], 'details': details})
            # backups
            cur_b.execute('SELECT site_name, site_domain, backup_date, size_mb, status, extra FROM backup_history WHERE client_id = ? ORDER BY backup_date DESC LIMIT 500', (client_id,))
            for r in cur_b.fetchall():
                bd = r['backup_date']
                ts = None
                try:
                    # parse date string to timestamp if possible
                    ts = int(datetime.datetime.fromisoformat(bd).timestamp()) if bd else None
                except Exception:
                    try:
                        ts = int(datetime.datetime.strptime(bd[:19], '%Y-%m-%d %H:%M:%S').timestamp())
                    except Exception:
                        ts = None
                if not ts:
                    ts = int(_time.time())
                human = None
                try:
                    human = datetime.datetime.fromtimestamp(ts).strftime('%d.%m.%Y %H:%M:%S')
                except Exception:
                    human = bd
                timeline.append({'type': 'backup', 'ts': ts, 'human': human, 'site_name': r['site_name'], 'site_domain': r['site_domain'], 'size_mb': r['size_mb'], 'status': r['status'], 'extra': r['extra']})
            conn_b.close()
        # include work_logs already in logs list
        for w in logs:
            # work_date is string; try parse to timestamp
            ts = None
            try:
                ts = int(datetime.datetime.fromisoformat(w.get('work_date')).timestamp())
            except Exception:
                try:
                    ts = int(datetime.datetime.strptime(w.get('work_date')[:19], '%Y-%m-%d %H:%M:%S').timestamp())
                except Exception:
                    ts = int(_time.time())
            timeline.append({'type': 'work_log', 'ts': ts, 'human': w.get('work_date_rus'), 'description': w.get('description'), 'hours': w.get('hours')})
        # sort timeline by timestamp desc
        timeline = sorted(timeline, key=lambda x: x.get('ts', 0), reverse=True)
    except Exception as e:
        print('Error building timeline:', e)

    return render_template_string(CLIENT_CARD_TEMPLATE, client=client, logs=logs, default_date_from=default_date_from, default_date_to=default_date_to, timeline=timeline)

@app.route("/client/<int:client_id>/update_beget", methods=["POST"])
def update_beget(client_id):
    login = request.form.get("beget_login", "").strip() # Changed from "login" to "beget_login"
    password = request.form.get("beget_pass", "").strip() # Changed from "password" to "beget_pass"
    api_key = request.form.get("beget_api_key", "").strip()
    sites = request.form.get("sites", "").strip()
    emails = request.form.get("emails", "").strip()
    schedule = request.form.get("report_schedule", "none").strip()
    sections = request.form.getlist('report_sections') if request.form.getlist('report_sections') else request.form.get('report_sections')
    if isinstance(sections, list):
        sections_val = ','.join(sections)
    else:
        sections_val = sections
    # report_start_day from form
    try:
        rsd = int(request.form.get('report_start_day'))
        if rsd < 1 or rsd > 28:
            rsd = None
    except Exception:
        rsd = None

    try:
        import crm_core
        crm_core.update_client_beget(client_id, login, password, sites, emails, schedule, sections_val, rsd, api_key)
        if not login and not api_key:
            flash("Настройки сохранены. Интеграция с хостингом ОТКЛЮЧЕНА (доступы пусты).", "warning")
        else:
            flash("Доступы Beget успешно сохранены и активированы!", "success")
    except Exception as e:
        flash(f"Ошибка при сохранении: {e}", "alert")
    
    return redirect(f"/client/{client_id}")

@app.route('/client/<int:client_id>/add_log', methods=['POST'])
def add_log(client_id):
    # allow specifying datetime-local field
    wd_local = request.form.get('work_date_local', '').strip()
    desc = request.form.get('description')
    hours = request.form.get('hours', 1.0)
    try:
        hours_val = float(hours)
    except Exception:
        hours_val = 1.0
    if wd_local:
        # wd_local is like '2026-08-18T14:10'
        wd = wd_local.replace('T', ' ')
        crm_core.add_work_log_with_date(client_id, desc, hours_val, wd)
    else:
        crm_core.add_work_log(client_id, desc, hours_val)
    return redirect(url_for('client_card', client_id=client_id))


@app.route('/client/<int:client_id>/edit_log/<int:log_id>', methods=['GET', 'POST'])
def edit_log(client_id, log_id):
    db = get_db()
    if request.method == 'GET':
        row = db.execute('SELECT * FROM work_logs WHERE id = ? AND client_id = ?', (log_id, client_id)).fetchone()
        if not row:
            return 'Not found', 404
        r = dict(row)
        # prepare simple edit form
        form = f"""
        <html><body>
        <h3>Редактировать запись</h3>
        <form method='POST'>
        Дата и время: <input type='datetime-local' name='work_date_local' value='{(r.get('work_date') or '').replace(' ', 'T')}'><br>
        Описание:<br><textarea name='description' rows='4'>{r.get('description') or ''}</textarea><br>
        Часы: <input type='number' step='0.5' name='hours' value='{r.get('hours') or 1.0}'><br>
        <button type='submit'>Сохранить</button>
        </form>
        </body></html>
        """
        return form
    else:
        wd_local = request.form.get('work_date_local', '').strip()
        desc = request.form.get('description')
        hours = request.form.get('hours', 1.0)
        try:
            hours_val = float(hours)
        except Exception:
            hours_val = 1.0
        wd = wd_local.replace('T', ' ') if wd_local else None
        if not wd:
            import datetime
            wd = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        crm_core.update_work_log(log_id, desc, hours_val, wd)
        return redirect(url_for('client_card', client_id=client_id))


@app.route('/client/<int:client_id>/delete_log/<int:log_id>')
def delete_log(client_id, log_id):
    crm_core.delete_work_log(log_id)
    return redirect(url_for('client_card', client_id=client_id))

@app.route('/client/<int:client_id>/report')
def generate_report(client_id):
    access_token = request.args.get('access_token')
    if access_token:
        access = _public_client_from_token(access_token)
        if not access or int(access['client_id']) != int(client_id):
            return 'Ссылка недействительна для этого клиента', 403
    import sqlite3, os, datetime, json
    from flask import render_template_string
    
    db_path = os.path.join(os.path.dirname(__file__), 'crm_data.db')
    backups_db_path = os.path.join(os.path.dirname(__file__), 'backups.db')
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    client = conn.execute('SELECT * FROM clients WHERE id=?', (client_id,)).fetchone()
    if not client:
        conn.close()
        return "Клиент не найден", 404
    client = dict(client)
    conn.close()
    
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    if not date_from or not date_to:
        today = datetime.date.today()
        date_from = today.replace(day=1).isoformat()
        date_to = today.isoformat()
    
    # Работы
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    logs = conn.execute('SELECT * FROM work_logs WHERE client_id=? AND work_date BETWEEN ? AND ? ORDER BY work_date DESC', (client_id, date_from, date_to)).fetchall()
    logs = [dict(row) for row in logs]
    conn.close()
    
    # Бэкапы и данные хостинга
    backups = []
    balance = 'Н/Д'
    domains_info = []
    
    if os.path.exists(backups_db_path):
        conn_b = sqlite3.connect(backups_db_path)
        conn_b.row_factory = sqlite3.Row
        
        # Уникальные бэкапы
        backup_rows = conn_b.execute('SELECT site_name, site_domain, backup_date, size_mb, source FROM backup_history WHERE client_id=? AND backup_date >= ? AND backup_date <= ? ORDER BY backup_date DESC', (client_id, date_from, date_to + ' 23:59:59')).fetchall()
        seen = set()
        for row in backup_rows:
            rd = dict(row)
            key = (rd.get('site_name'), rd.get('backup_date'))
            if key not in seen:
                seen.add(key)
                backups.append(rd)
        
        # Последний снимок для баланса и доменов
        last_snapshot = conn_b.execute('SELECT details FROM host_events WHERE event_type=? AND client_id=? ORDER BY event_time DESC LIMIT 1', ('beget_snapshot', client_id)).fetchone()
        if last_snapshot:
            try:
                details = json.loads(last_snapshot['details'])
                account = details.get('account', {})
                bal = account.get('user_balance') or account.get('balance')
                if bal is not None:
                    balance = f"{bal} руб."
                
                snap_data = details.get('snapshot', {})
                raw_domains = snap_data.get('domains', [])
                for d in raw_domains:
                    if isinstance(d, dict):
                        domain_name = d.get('fqdn') or d.get('domain')
                        ssl_status = d.get('ssl_status', 'unknown')
                        date_expire = d.get('date_expire', '')
                        if domain_name:
                            domains_info.append({
                                'domain': domain_name,
                                'ssl': '✅ Включен' if ssl_status in ['le_set', 'custom_set', 'active'] else '❌ Выключен',
                                'expire': date_expire if date_expire else 'Н/Д'
                            })
            except Exception as e:
                print(f"Error parsing snapshot: {e}")
        
        conn_b.close()
    
    try:
        date_from_rus = datetime.datetime.strptime(date_from, '%Y-%m-%d').strftime('%d.%m.%Y')
        date_to_rus = datetime.datetime.strptime(date_to, '%Y-%m-%d').strftime('%d.%m.%Y')
    except:
        date_from_rus = date_from
        date_to_rus = date_to
    
    return render_template_string(REPORT_TEMPLATE,
        client=client, logs=logs, backups=backups,
        balance=balance, domains=domains_info,
        date_from=date_from_rus, date_to=date_to_rus
    )


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('CRM_PORT', '3002')))



@app.errorhandler(Exception)
def handle_all_errors(e):
    # Подробности остаются в systemd journal; наружу не выдаём пути,
    # переменные окружения, клиентские данные и traceback.
    app.logger.exception('Unhandled CRM exception')
    return render_template_string('''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ошибка CRM</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(560px,calc(100% - 32px));padding:32px;background:#fff;border-radius:24px;box-shadow:0 18px 50px #24314d18}a{display:inline-block;margin-top:14px;color:#202b45}</style></head><body><main class="card"><h1>Не удалось выполнить операцию</h1><p>Ошибка записана в защищённый журнал. Повторите действие позже или обратитесь к администратору CRM.</p><a href="/">Вернуться на главную</a></main></body></html>'''), 500
