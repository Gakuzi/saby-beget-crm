from flask import Flask, render_template_string, request, redirect, url_for, jsonify, flash
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

INDEX_TEMPLATE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Saby & Beget CRM - Климов Евгений</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #2e1065 0%, #1e1b4b 50%, #0f172a 100%); min-height: 100vh; color: #f1f5f9; padding: 25px; margin: 0; }
        .container { max-width: 1000px; margin: auto; background: #1e293b; padding: 25px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        h2 { color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 10px; border: 1px solid #334155; text-align: left; font-size: 14px; }
        th { background: #0f172a; color: #38bdf8; }
        a { color: #38bdf8; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .btn { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; padding: 10px 18px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); transition: all 0.2s ease; }
        .btn:hover { background: #1d4ed8; }
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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #2e1065 0%, #1e1b4b 50%, #0f172a 100%); min-height: 100vh; color: #f1f5f9; padding: 25px; margin: 0; }
        .container { max-width: 700px; margin: auto; background: #1e293b; padding: 25px; border-radius: 8px; }
        .form-group { margin-bottom: 15px; position: relative; }
        input, select { width: 100%; padding: 10px; box-sizing: border-box; background: #0f172a; border: 1px solid #475569; color: white; border-radius: 4px; }
        button { background: #2563eb; color: white; padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        a { color: #38bdf8; }
        .suggest-item { padding: 10px; cursor: pointer; border-bottom: 1px solid #334155; background: #0f172a; }
        .suggest-item:hover { background: #334155; }
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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #2e1065 0%, #1e1b4b 50%, #0f172a 100%); min-height: 100vh; color: #f1f5f9; padding: 25px; margin: 0; }
        .container { max-width: 950px; margin: auto; background: #1e293b; padding: 25px; border-radius: 8px; }
        h2, h3 { color: #38bdf8; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .box { background: #0f172a; padding: 15px; border-radius: 6px; border: 1px solid #334155; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px; border: 1px solid #334155; text-align: left; font-size: 13px; }
        th { background: #0f172a; color: #38bdf8; }
        input, textarea { width: 100%; padding: 8px; box-sizing: border-box; background: #0f172a; border: 1px solid #475569; color: white; border-radius: 4px; margin-top: 5px; }
        button, .btn-link { background: #2563eb; color: white; padding: 8px 14px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 10px; text-decoration:none; display:inline-block; }
        button:hover, .btn-link:hover { background: #1d4ed8; }
        a { color: #38bdf8; }
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
                    <button type="submit">Сохранить доступы</button>
                </form>
            </div>
        </div>

        <div style="margin-top: 25px;" class="box">
            <h3>Генерация отчета и мониторинг</h3>
            <p>Выберите период для формирования отчета со списком выполненных работ, бэкапов (включая 1С-Битрикс), состоянием доменов, почты и баланса хостинга.</p>
            <form action="/client/{{ client.id }}/report" method="GET" style="display: flex; gap: 10px; align-items: flex-end; margin-top: 10px;" target="_blank">
                <div style="flex: 1;">
                    <label style="font-size: 13px;">Дата с:</label>
                    <input type="date" name="date_from" value="{{ default_date_from }}" style="margin-top:5px; padding:8px; background:#0f172a; border:1px solid #475569; color:white; border-radius:4px; width:100%;">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 13px;">Дата по:</label>
                    <input type="date" name="date_to" value="{{ default_date_to }}" style="margin-top:5px; padding:8px; background:#0f172a; border:1px solid #475569; color:white; border-radius:4px; width:100%;">
                </div>
                <div>
                    <button type="submit" class="btn-link" style="margin-top: 0; padding: 10px 14px;">Сформировать отчет</button>
                    <button type="button" onclick="openPrevMonth()" style="margin-top:0; margin-left:8px; padding:10px 12px;" class="btn-link">Прошлый месяц</button>
                </div>
            </form>
            <script>
                function openPrevMonth(){
                    const now = new Date();
                    const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const lastMonthEnd = new Date(firstThisMonth.getTime() - 1);
                    const from = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
                    const to = lastMonthEnd;
                    const fmt = (d)=> d.toISOString().slice(0,10);
                    const url = `/client/{{ client.id }}/report?date_from=${fmt(from)}&date_to=${fmt(to)}`;
                    window.open(url, '_blank');
                }
            </script>
        </div>

        <h3 style="margin-top:25px;">Учет выполненных работ и обращений</h3>
        <table>
            <tr><th>Дата</th><th>Описание работ / бэкапов / инцидентов</th><th>Часы</th></tr>
            {% for log in logs %}
            <tr><td>{{ log.work_date }}</td><td>{{ log.description }}</td><td>{{ log.hours }} ч.</td></tr>
            {% else %}
            <tr><td colspan="3" style="text-align:center; color:#94a3b8;">Нет записей</td></tr>
            {% endfor %}
        </table>

        <form action="/client/{{ client.id }}/add_log" method="POST" style="margin-top:15px;" class="box">
            <h4>Добавить запись о работах</h4>
            <textarea name="description" rows="2" placeholder="Например: Штатный бэкап, создание почтового ящика info@site.ru..." required></textarea>
            <label style="margin-top:10px; display:block;">Часы:</label>
            <input type="number" step="0.5" name="hours" value="1.0" required style="width: 100px;">
            <button type="submit">Добавить запись</button>
        </form>
    </div>
</body>
</html>
"""

REPORT_TEMPLATE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Отчет для {{ client.company_name }}</title>
    <style>
        body { font-family: Arial, sans-serif; background: #fff; color: #000; padding: 30px; }
        .report-container { max-width: 800px; margin: auto; border: 1px solid #ccc; padding: 30px; }
        h2, h3 { border-bottom: 2px solid #000; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #999; padding: 8px; text-align: left; font-size: 14px; }
        th { background: #eee; }
        .no-print { margin-top: 20px; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="report-container">
        <h2>Отчет о сопровождении ИТ-инфраструктуры за период с {{ date_from }} по {{ date_to }}</h2>
        <p><strong>Заказчик:</strong> {{ client.company_name }} (ИНН: {{ client.inn }})</p>
        <p><strong>Основание:</strong> Договор № {{ client.saby_contract_number }}</p>
        <p><strong>Исполнитель:</strong> Самозанятый Климов Евгений Александрович</p>
        <p><strong>Обслуживаемые сайты:</strong> {{ client.sites }}</p>

        <h3>Состояние хостинга и доменов (Beget API)</h3>
        <p>{{ beget_status }}</p>

        <h3>События хостинга (Beget)</h3>
        <table>
            <tr><th>Дата/Время</th><th>Тип</th><th>Сайт / Аккаунт</th><th>Детали</th></tr>
            {% for ev in host_events %}
            <tr>
                <td>{{ ev.human_time or '-' }}</td>
                <td>{{ ev.event_type }}</td>
                <td>{{ ev.site or ev.host_account }}</td>
                <td><pre style="white-space:pre-wrap;">{{ ev.details }}</pre></td>
            </tr>
            {% else %}
            <tr><td colspan="4" style="text-align:center;">За период событий хостинга не найдено</td></tr>
            {% endfor %}
        </table>

        <h3>Резервные копии (Автоматические и 1С-Битрикс)</h3>
        <table>
            <tr><th>Сайт / Источник</th><th>Дата бэкапа</th><th>Размер</th></tr>
            {% for b in backups %}
            <tr><td>{{ b.site_name }}</td><td>{{ b.backup_date }}</td><td>{{ b.size_mb }} МБ</td></tr>
            {% else %}
            <tr><td colspan="3" style="text-align:center;">За выбранный период бэкапов в базе не зафиксировано</td></tr>
            {% endfor %}
        </table>

        <h3>Выполненные работы, бэкапы и обращения</h3>
        <table>
            <tr><th>Дата</th><th>Описание</th><th>Затрачено часов</th></tr>
            {% for log in logs %}
            <tr><td>{{ log.work_date }}</td><td>{{ log.description }}</td><td>{{ log.hours }} ч.</td></tr>
            {% endfor %}
        </table>

        <div class="no-print">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Напечатать / Сохранить в PDF</button>
        </div>
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

@app.route('/client/<int:client_id>')
def client_card(client_id):
    db = get_db()
    row = db.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    client = dict(row) if row else {}
    logs = db.execute('SELECT * FROM work_logs WHERE client_id = ? ORDER BY work_date DESC', (client_id,)).fetchall()

    # default dates: previous month
    import datetime
    today = datetime.date.today()
    first_this_month = today.replace(day=1)
    last_month_end = first_this_month - datetime.timedelta(days=1)
    default_date_from = last_month_end.replace(day=1).strftime('%Y-%m-%d')
    default_date_to = last_month_end.strftime('%Y-%m-%d')

    return render_template_string(CLIENT_CARD_TEMPLATE, client=client, logs=logs, default_date_from=default_date_from, default_date_to=default_date_to)

@app.route("/client/<int:client_id>/update_beget", methods=["POST"])
def update_beget(client_id):
    login = request.form.get("beget_login", "").strip() # Changed from "login" to "beget_login"
    password = request.form.get("beget_pass", "").strip() # Changed from "password" to "beget_pass"
    sites = request.form.get("sites", "").strip()
    emails = request.form.get("emails", "").strip()
    schedule = request.form.get("report_schedule", "none").strip()
    try:
        import crm_core
        crm_core.update_client_beget(client_id, login, password, sites, emails, schedule)
        if not login or not password:
            flash("Настройки сохранены. Интеграция с хостингом ОТКЛЮЧЕНА (доступы пусты).", "warning")
        else:
            flash("Доступы Beget успешно сохранены и активированы!", "success")
    except Exception as e:
        flash(f"Ошибка при сохранении: {e}", "alert")
        
    return redirect(f"/client/{client_id}")

@app.route('/client/<int:client_id>/add_log', methods=['POST'])
def add_log(client_id):
    crm_core.add_work_log(client_id, request.form.get('description'), request.form.get('hours', 1.0))
    return redirect(url_for('client_card', client_id=client_id))

@app.route('/client/<int:client_id>/report')
def generate_report(client_id):
    db = get_db()
    row = db.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
    client = dict(row) if row else {}
    
    import datetime
    today = datetime.date.today()
    date_from = request.args.get('date_from', today.replace(day=1).strftime('%Y-%m-%d'))
    date_to = request.args.get('date_to', today.strftime('%Y-%m-%d'))

    logs = db.execute('SELECT * FROM work_logs WHERE client_id = ? AND work_date BETWEEN ? AND ? ORDER BY work_date DESC', (client_id, date_from, date_to)).fetchall()
    
    backups = []
    try:
        import os
        db_path_backups = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups.db')
        if os.path.exists(db_path_backups):
            conn_b = sqlite3.connect(db_path_backups)
            conn_b.row_factory = sqlite3.Row
            cursor_b = conn_b.cursor()

            # Получаем все бэкапы за период, затем фильтруем по списку сайтов клиента
            cursor_b.execute('SELECT site_name, site_domain, backup_date, size_mb, extra FROM backup_history WHERE date(backup_date) BETWEEN ? AND ? ORDER BY backup_date DESC', (date_from, date_to))
            all_rows = [dict(r) for r in cursor_b.fetchall()]

            client_sites_raw = client.get('sites') or ''
            client_sites = [s.strip().lower().replace('https://','').replace('http://','').split('/')[0] for s in client_sites_raw.split(',') if s.strip()]
            company_name = (client.get('company_name') or '').strip()

            # фильтрация по site_mapping (client_id)
            backups = []
            # если у клиента есть client_id, используем прямой запрос
            client_id = client.get('id')
            if client_id:
                cursor_b.execute('SELECT site_name, site_domain, backup_date, size_mb, extra FROM backup_history WHERE client_id = ? AND date(backup_date) BETWEEN ? AND ? ORDER BY backup_date DESC', (client_id, date_from, date_to))
                backups = [dict(r) for r in cursor_b.fetchall()]
            else:
                # fallback: фильтруем по доменам в поле sites
                for r in all_rows:
                    domain = (r.get('site_domain') or '').lower()
                    name = (r.get('site_name') or '').strip()
                    matched = False
                    if domain and domain in client_sites:
                        matched = True
                    if not matched and company_name and company_name == name:
                        matched = True
                    if matched:
                        backups.append(r)

            conn_b.close()

            # Если ничего не найдено для клиента, покажем все бэкапы за период (для отладки)
            if not backups:
                backups = all_rows
                backups_note = 'Показаны все бэкапы за период, сопоставление с сайтом клиента не обнаружило совпадений.'
            else:
                backups_note = ''

    except Exception as e:
        print(f'Error loading backups: {e}')

    beget_status = 'Доступы Beget не настроены в карточке.'
    beget_data = {}
    login = client.get('beget_login')
    password = client.get('beget_password') or client.get('beget_pass')
    if login and password:
        try:
            import beget_helper
            beget_data = beget_helper.get_full_beget_report(login, password)
            if not beget_data.get('error'):
                bal = beget_data.get('account', {}).get('balance', 'Н/Д')
                beget_status = f'Хостинг активен. Баланс аккаунта: {bal} руб. Сайтов: {len(beget_data.get("sites", []))}, доменов: {len(beget_data.get("domains", []))}, почтовых ящиков: {len(beget_data.get("mailboxes", []))}.'
            else:
                beget_status = f'Ошибка Beget API: {beget_data.get("error")}'
        except Exception as e:
            beget_status = f'Не удалось связаться с Beget API: {str(e)}'

    # Получаем события хостинга из backups.db host_events за период
    host_events = []
    try:
        import os
        db_path_backups = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups.db')
        if os.path.exists(db_path_backups):
            conn_b = sqlite3.connect(db_path_backups)
            conn_b.row_factory = sqlite3.Row
            cur_b = conn_b.cursor()
            # client_id may be null — but we filter by client.id when available
            if client_id:
                cur_b.execute('SELECT * FROM host_events WHERE client_id = ? AND event_time BETWEEN ? AND ? ORDER BY event_time DESC', (client_id, int(datetime.datetime.strptime(date_from, '%Y-%m-%d').timestamp()), int(datetime.datetime.strptime(date_to, '%Y-%m-%d').timestamp()) + 86400))
            else:
                cur_b.execute('SELECT * FROM host_events WHERE event_time BETWEEN ? AND ? ORDER BY event_time DESC', (int(datetime.datetime.strptime(date_from, '%Y-%m-%d').timestamp()), int(datetime.datetime.strptime(date_to, '%Y-%m-%d').timestamp()) + 86400))
            rows = [dict(r) for r in cur_b.fetchall()]
            for r in rows:
                human = None
                try:
                    human = datetime.datetime.fromtimestamp(r.get('event_time')).strftime('%Y-%m-%d %H:%M:%S') if r.get('event_time') else None
                except Exception:
                    human = None
                host_events.append({
                    'id': r.get('id'),
                    'client_id': r.get('client_id'),
                    'host_account': r.get('host_account'),
                    'site': r.get('site'),
                    'event_type': r.get('event_type'),
                    'details': r.get('details'),
                    'event_time': r.get('event_time'),
                    'human_time': human,
                    'source': r.get('source')
                })
            conn_b.close()
    except Exception as e:
        print(f'Error loading host_events: {e}')

    print(f'[REPORT] client_id={client_id} backups_count={len(backups)} host_events={len(host_events)}')
    return render_template_string(REPORT_TEMPLATE, client=client, logs=logs, backups=backups, beget_status=beget_status, beget_data=beget_data, date_from=date_from, date_to=date_to, host_events=host_events)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3002)

