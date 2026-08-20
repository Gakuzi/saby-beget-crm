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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg,#fffaf0 0%, #ffffff 100%); min-height: 100vh; color: #2b2f2f; padding: 25px; margin: 0; }
        .container { max-width: 1000px; margin: auto; background: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 6px 18px rgba(43,45,48,0.04); }
        h2 { color: #6b5a57; border-bottom: 1px solid #f0e9e6; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 10px; border: 1px solid #f0e9e6; text-align: left; font-size: 14px; }
        th { background: #f8f4f3; color: #6b5a57; }
        a { color: #6b5a57; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .btn { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; padding: 10px 18px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); transition: all 0.2s ease; }
        .btn:hover { background: #1d4ed8; }
        .settings-icon { position: fixed; top: 20px; right: 20px; font-size: 24px; cursor: pointer; z-index: 1000; }
        .settings-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 1001; }
        .settings-content { background: #1e293b; max-width: 800px; margin: 50px auto; padding: 25px; border-radius: 8px; }
        .tab-buttons { display: flex; gap: 10px; border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 20px; }
        .tab-btn { background: transparent; border: 1px solid #475569; color: #94a3b8; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
        .tab-btn.active { background: #2563eb; color: white; border-color: #2563eb; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; color: #38bdf8; }
        .form-group input, .form-group textarea { width: 100%; padding: 10px; background: #0f172a; border: 1px solid #475569; color: white; border-radius: 4px; box-sizing: border-box; }
        .close-btn { float: right; font-size: 24px; cursor: pointer; color: #94a3b8; }
        .close-btn:hover { color: white; }
        .btn { background: linear-gradient(135deg,#ffd6c2 0%, #ffb4a2 100%); color: #2b2f2f; padding: 10px 18px; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; transition: all 0.15s ease; box-shadow: 0 6px 12px rgba(255,180,162,0.12); }
        .btn:hover { filter: brightness(0.97); }
    </style>
    <script>
        function openSettings() { document.getElementById('settingsModal').style.display = 'block'; }
        function closeSettings() { document.getElementById('settingsModal').style.display = 'none'; }
        function switchSettingsTab(tabId) {
            document.querySelectorAll('.settings-content .tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.settings-content .tab-btn').forEach(el => el.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            event.target.classList.add('active');
        }
        window.onclick = function(event) {
            const modal = document.getElementById('settingsModal');
            if (event.target == modal) { modal.style.display = 'none'; }
        }
    </script>
</head>
<body>
    <div class="container">
        <span class="settings-icon" onclick="openSettings()" title="Настройки">⚙️</span>
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

    <!-- Модальное окно настроек -->
    <div id="settingsModal" class="settings-modal">
        <div class="settings-content">
            <span class="close-btn" onclick="closeSettings()">&times;</span>
            <h2>⚙️ Настройки CRM</h2>
            
            <div class="tab-buttons">
                <button class="tab-btn active" onclick="switchSettingsTab('tab-email')">📧 Настройки почты</button>
                <button class="tab-btn" onclick="switchSettingsTab('tab-beget')">🌐 Beget API</button>
                <button class="tab-btn" onclick="switchSettingsTab('tab-saby')">📄 Saby интеграция</button>
                <button class="tab-btn" onclick="switchSettingsTab('tab-system')">🔧 Системные</button>
            </div>

            <div id="tab-email" class="tab-content active">
                <h3>Настройки электронной почты</h3>
                <form action="/settings/email" method="POST">
                    <div class="form-group">
                        <label>SMTP сервер:</label>
                        <input type="text" name="smtp_server" placeholder="smtp.example.com" value="{{ settings.smtp_server or '' }}">
                    </div>
                    <div class="form-group">
                        <label>SMTP порт:</label>
                        <input type="number" name="smtp_port" placeholder="587" value="{{ settings.smtp_port or '587' }}">
                    </div>
                    <div class="form-group">
                        <label>Email отправителя:</label>
                        <input type="email" name="sender_email" placeholder="reports@example.com" value="{{ settings.sender_email or '' }}">
                    </div>
                    <div class="form-group">
                        <label>Пароль приложения:</label>
                        <input type="password" name="sender_password" value="{{ settings.sender_password or '' }}">
                    </div>
                    <div class="form-group">
                        <label>Email для отчетов по умолчанию:</label>
                        <input type="email" name="default_report_email" placeholder="admin@example.com" value="{{ settings.default_report_email or '' }}">
                    </div>
                    <button type="submit" class="btn">Сохранить настройки почты</button>
                </form>
            </div>

            <div id="tab-beget" class="tab-content">
                <h3>Настройки Beget API</h3>
                <p style="color: #94a3b8; margin-bottom: 15px;">Beget API использует логин и пароль от панели управления. Отдельный API-ключ не требуется.</p>
                <form action="/settings/beget" method="POST">
                    <div class="form-group">
                        <label>Логин Beget (по умолчанию):</label>
                        <input type="text" name="beget_login" value="{{ settings.beget_login or '' }}">
                    </div>
                    <div class="form-group">
                        <label>Пароль Beget (по умолчанию):</label>
                        <input type="password" name="beget_password" value="{{ settings.beget_password or '' }}">
                    </div>
                    <button type="submit" class="btn">Сохранить настройки Beget</button>
                </form>
            </div>

            <div id="tab-saby" class="tab-content">
                <h3>Настройки Saby (СБИС)</h3>
                <form action="/settings/saby" method="POST">
                    <div class="form-group">
                        <label>API ключ Saby:</label>
                        <input type="text" name="saby_api_key" value="{{ settings.saby_api_key or '' }}">
                    </div>
                    <div class="form-group">
                        <label>Организация Saby (ID):</label>
                        <input type="text" name="saby_org_id" value="{{ settings.saby_org_id or '' }}">
                    </div>
                    <button type="submit" class="btn">Сохранить настройки Saby</button>
                </form>
            </div>

            <div id="tab-system" class="tab-content">
                <h3>Системные настройки</h3>
                <form action="/settings/system" method="POST">
                    <div class="form-group">
                        <label>Название компании:</label>
                        <input type="text" name="company_name" value="{{ settings.company_name or '' }}">
                    </div>
                    <div class="form-group">
                        <label>Интервал автоотчетов (часы):</label>
                        <input type="number" name="auto_report_interval" value="{{ settings.auto_report_interval or '24' }}">
                    </div>
                    <button type="submit" class="btn">Сохранить системные настройки</button>
                </form>
            </div>
        </div>
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
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #2e1065 0%, #1e1b4b 50%, #0f172a 100%); min-height: 100vh; color: #f1f5f9; padding: 25px; margin: 0; }
        .container { max-width: 1200px; margin: auto; background: #1e293b; padding: 25px; border-radius: 8px; }
        h2, h3, h4 { color: #38bdf8; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg,#fffaf0 0%, #ffffff 100%); min-height: 100vh; color: #2b2f2f; padding: 25px; margin: 0; }
        .container { max-width: 950px; margin: auto; background: #ffffff; padding: 25px; border-radius: 8px; }
        h2, h3 { color: #6b5a57; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .box { background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #f0e9e6; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px; border: 1px solid #334155; text-align: left; font-size: 13px; }
        th { background: #0f172a; color: #38bdf8; }
        input, textarea { width: 100%; padding: 8px; box-sizing: border-box; background: #0f172a; border: 1px solid #475569; color: white; border-radius: 4px; margin-top: 5px; }
        button, .btn-link { background: #2563eb; color: white; padding: 8px 14px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 10px; text-decoration:none; display:inline-block; }
        button:hover, .btn-link:hover { background: #1d4ed8; }
        .btn-success { background: #10b981; }
        .btn-success:hover { background: #059669; }
        a { color: #38bdf8; }
        .tab-container { margin-top: 20px; }
        .tab-buttons { display: flex; gap: 10px; border-bottom: 2px solid #334155; padding-bottom: 10px; }
        .tab-btn { background: transparent; border: 1px solid #475569; color: #94a3b8; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
        .tab-btn.active { background: #2563eb; color: white; border-color: #2563eb; }
        .tab-content { display: none; padding: 15px 0; }
        .tab-content.active { display: block; }
        .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status-done { background: #10b981; color: white; }
        .status-pending { background: #f59e0b; color: white; }
        .status-cancelled { background: #ef4444; color: white; }
        th, td { padding: 8px; border: 1px solid #f0e9e6; text-align: left; font-size: 13px; }
        th { background: #f8f4f3; color: #6b5a57; }
        input, textarea { width: 100%; padding: 8px; box-sizing: border-box; background: #fff; border: 1px solid #f0e9e6; color: #2b2f2f; border-radius: 6px; margin-top: 5px; }
        button, .btn-link { background: linear-gradient(135deg,#ffd6c2 0%, #ffb4a2 100%); color: #2b2f2f; padding: 8px 14px; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; margin-top: 10px; text-decoration:none; display:inline-block; box-shadow: 0 6px 12px rgba(255,180,162,0.08); }
        button:hover, .btn-link:hover { filter: brightness(0.98); }
        a { color: #6b5a57; }
    </style>
    <script>
        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            event.target.classList.add('active');
        }
        function syncSaby(clientId) {
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = 'Синхронизация...';
            fetch('/api/saby/sync/' + clientId, {method: 'POST'})
                .then(r => r.json())
                .then(data => {
                    btn.disabled = false;
                    btn.textContent = '✓ Синхронизировано';
                    setTimeout(() => { location.reload(); }, 1500);
                })
                .catch(err => {
                    btn.disabled = false;
                    btn.textContent = 'Ошибка синхронизации';
                    alert('Ошибка: ' + err);
                });
        }
    </script>
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
                    <input type="password" name="beget_pass" value="{{ client.beget_password or '' }}">
                    <label>Сайты:</label>
                    <input type="text" name="sites" value="{{ client.sites or '' }}">
                    <label>Email для отчетов (через запятую):</label>
                    <input type="text" name="emails" value="{{ client.email_reports or '' }}">
                    <button type="submit">Сохранить доступы</button>
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
            <h3>Генерация отчета и мониторинг</h3>
            <p>Выберите период для формирования отчета со списком выполненных работ, бэкапов (включая 1С-Битрикс), состоянием доменов, почты и баланса хостинга.</p>
            <form action="/client/{{ client.id }}/report" method="GET" style="display: flex; gap: 10px; align-items: flex-end; margin-top: 10px;" target="_blank">
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

        <!-- Вкладки с данными из Saby -->
        <div class="tab-container">
            <div class="tab-buttons">
                <button class="tab-btn active" onclick="switchTab('tab-works')">📋 Работы из Saby</button>
                <button class="tab-btn" onclick="switchTab('tab-requests')">📞 Обращения</button>
                <button class="tab-btn" onclick="switchTab('tab-documents')">📄 Документы (Акты/Счета)</button>
                <button class="tab-btn" onclick="switchTab('tab-local')">✏️ Локальные записи</button>
            </div>

            <div id="tab-works" class="tab-content active">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h4>Выполненные работы из СБИС</h4>
                    <button class="btn-success" onclick="syncSaby({{ client.id }})">🔄 Синхронизировать с Saby</button>
                </div>
                <table>
                    <tr><th>Дата</th><th>Наименование работы</th><th>Количество</th><th>Ед. изм.</th><th>Цена</th><th>Сумма</th></tr>
                    {% for work in saby_works %}
                    <tr>
                        <td>{{ work.work_date }}</td>
                        <td>{{ work.name }}</td>
                        <td>{{ work.quantity }}</td>
                        <td>{{ work.unit }}</td>
                        <td>{{ work.price }} ₽</td>
                        <td>{{ work.total }} ₽</td>
                    </tr>
                    {% else %}
                    <tr><td colspan="6" style="text-align:center; color:#94a3b8;">Нет данных. Нажмите "Синхронизировать с Saby"</td></tr>
                    {% endfor %}
                </table>
            </div>

            <div id="tab-requests" class="tab-content">
                <h4>Обращения клиентов из СБИС</h4>
                <table>
                    <tr><th>Дата создания</th><th>Тема</th><th>Статус</th><th>Ответственный</th></tr>
                    {% for req in saby_requests %}
                    <tr>
                        <td>{{ req.created_date }}</td>
                        <td>{{ req.subject }}</td>
                        <td><span class="status-badge {% if req.status == 'Завершено' %}status-done{% elif req.status == 'В работе' %}status-pending{% else %}status-cancelled{% endif %}">{{ req.status }}</span></td>
                        <td>{{ req.responsible or '-' }}</td>
                    </tr>
                    {% else %}
                    <tr><td colspan="4" style="text-align:center; color:#94a3b8;">Нет обращений</td></tr>
                    {% endfor %}
                </table>
            </div>

            <div id="tab-documents" class="tab-content">
                <h4>Документы из СБИС (Акты, Счета)</h4>
                <table>
                    <tr><th>Тип</th><th>Номер</th><th>Дата</th><th>Сумма</th><th>Статус</th></tr>
                    {% for doc in saby_documents %}
                    <tr>
                        <td>{{ doc.doc_type }}</td>
                        <td>{{ doc.number }}</td>
                        <td>{{ doc.date }}</td>
                        <td>{{ doc.amount }} ₽</td>
                        <td><span class="status-badge {% if doc.status == 'Подписан' %}status-done{% elif doc.status == 'На подписании' %}status-pending{% else %}status-cancelled{% endif %}">{{ doc.status }}</span></td>
                    </tr>
                    {% else %}
                    <tr><td colspan="5" style="text-align:center; color:#94a3b8;">Нет документов</td></tr>
                    {% endfor %}
                </table>
            </div>

            <div id="tab-local" class="tab-content">
                <h4>Локальные записи о работах</h4>
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
                                {{ e.event_type }} — {{ e.details }}
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
        <p style="color:#b91c1c;">Алерты доменов: {% if domain_alerts %}{% for a in domain_alerts %}<strong>{{ a.domain }}</strong> истекает {{ a.expires }} (через {{ a.days_left }} дней) — {{ a.severity }}{% if not loop.last %}; {% endif %}{% endfor %}{% else %}критичных доменов не обнаружено{% endif %}</p>

        <h4>Краткая сводка по событиям</h4>
        {% if grouped_events.snapshots %}
            <p>Последние снимки аккаунта: {{ grouped_events.snapshots|length }}</p>
        {% endif %}

        <table>
            <tr><th>Дата/Время</th><th>Категория</th><th>Объект</th><th>Описание</th><th>Влияние</th></tr>
            {% set any = false %}
            {% for cat, items in grouped_events.items() %}
                {% for ev in items %}
                    {% set any = true %}
                    <tr>
                        <td>{{ ev.human_time or '-' }}</td>
                        <td>{{ cat }}</td>
                        <td>{{ (ev.details.domain if ev.details is mapping and ev.details.domain) or (ev.site) or (ev.host_account) or '-' }}</td>
                        <td>{{ ev.description }}</td>
                        <td>{{ ev.impact }}{% if ev.impact_note %}: {{ ev.impact_note }}{% endif %}</td>
                    </tr>
                {% endfor %}
            {% endfor %}
            {% if not any %}
            <tr><td colspan="5" style="text-align:center;">За период событий хостинга не найдено</td></tr>
            {% endif %}
        </table>

        <h3>Резервные копии (Автоматические и 1С-Битрикс)</h3>
        <table>
            <tr><th>Сайт / Источник</th><th>Дата бэкапа</th><th>Размер</th></tr>
            {% for b in backups %}
            <tr><td>{{ b.site_name }}</td><td>{{ b.backup_date_rus or b.backup_date }}</td><td>{% if b.size_mb %}{{ b.size_mb }} МБ{% else %}-{% endif %}</td></tr>
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
    
    # Загружаем настройки из таблицы settings
    settings_row = db.execute('SELECT * FROM settings LIMIT 1').fetchone()
    settings = dict(settings_row) if settings_row else {}
    
    return render_template_string(INDEX_TEMPLATE, clients=clients, settings=settings)

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
    
    # Загружаем данные из Saby для этого клиента
    saby_works = []
    saby_requests = []
    saby_documents = []
    
    if client.get('inn'):
        try:
            # Получаем работы из БД
            saby_works = db.execute(
                'SELECT * FROM saby_works WHERE inn = ? ORDER BY work_date DESC', 
                (client['inn'],)
            ).fetchall()
            saby_works = [dict(w) for w in saby_works]
            
            # Получаем обращения
            saby_requests = db.execute(
                'SELECT * FROM saby_requests WHERE inn = ? ORDER BY created_date DESC',
                (client['inn'],)
            ).fetchall()
            saby_requests = [dict(r) for r in saby_requests]
            
            # Получаем документы
            saby_documents = db.execute(
                'SELECT * FROM saby_documents WHERE inn = ? ORDER BY date DESC',
                (client['inn'],)
            ).fetchall()
            saby_documents = [dict(d) for d in saby_documents]
        except Exception as e:
            print(f'Error loading Saby data: {e}')
    
    return render_template_string(CLIENT_CARD_TEMPLATE, 
                                  client=client, 
                                  logs=logs,
                                  saby_works=saby_works,
                                  saby_requests=saby_requests,
                                  saby_documents=saby_documents)
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

@app.route('/api/saby/sync/<int:client_id>', methods=['POST'])
def api_saby_sync(client_id):
    """API endpoint для ручной синхронизации с Saby"""
    try:
        from saby_integration import run_daily_sync
        db = get_db()
        client = db.execute('SELECT * FROM clients WHERE id = ?', (client_id,)).fetchone()
        
        if not client:
            return jsonify({'error': 'Клиент не найден'}), 404
        
        # Запускаем синхронизацию для конкретного клиента
        result = run_daily_sync(client_id)
        
        return jsonify({
            'success': True,
            'message': 'Синхронизация завершена',
            'details': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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

    return render_template_string(REPORT_TEMPLATE, client=client, logs=logs, backups=backups, beget_status=beget_status, beget_data=beget_data, date_from=date_from, date_to=date_to)

# Маршруты для настроек CRM
@app.route('/settings/email', methods=['POST'])
def save_email_settings():
    db = get_db()
    # Создаем таблицу settings если не существует
    db.execute('''CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        smtp_server TEXT,
        smtp_port TEXT,
        sender_email TEXT,
        sender_password TEXT,
        default_report_email TEXT,
        beget_login TEXT,
        beget_password TEXT,
        saby_api_key TEXT,
        saby_org_id TEXT,
        company_name TEXT,
        auto_report_interval TEXT
    )''')
    
    # Проверяем есть ли запись
    existing = db.execute('SELECT id FROM settings LIMIT 1').fetchone()
    if existing:
        db.execute('''UPDATE settings SET 
            smtp_server=?, smtp_port=?, sender_email=?, sender_password=?, default_report_email=?
            WHERE id=?''', 
            (request.form.get('smtp_server'), request.form.get('smtp_port'), 
             request.form.get('sender_email'), request.form.get('sender_password'),
             request.form.get('default_report_email'), existing['id']))
    else:
        db.execute('''INSERT INTO settings (smtp_server, smtp_port, sender_email, sender_password, default_report_email)
            VALUES (?, ?, ?, ?, ?)''',
            (request.form.get('smtp_server'), request.form.get('smtp_port'),
             request.form.get('sender_email'), request.form.get('sender_password'),
             request.form.get('default_report_email')))
    db.commit()
    flash('Настройки почты сохранены', 'success')
    return redirect(url_for('index'))

@app.route('/settings/beget', methods=['POST'])
def save_beget_settings():
    db = get_db()
    db.execute('''CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        smtp_server TEXT, smtp_port TEXT, sender_email TEXT, sender_password TEXT,
        default_report_email TEXT, beget_login TEXT, beget_password TEXT,
        saby_api_key TEXT, saby_org_id TEXT, company_name TEXT, auto_report_interval TEXT
    )''')
    
    existing = db.execute('SELECT id FROM settings LIMIT 1').fetchone()
    if existing:
        db.execute('UPDATE settings SET beget_login=?, beget_password=? WHERE id=?',
            (request.form.get('beget_login'), request.form.get('beget_password'), existing['id']))
    else:
        db.execute('INSERT INTO settings (beget_login, beget_password) VALUES (?, ?)',
            (request.form.get('beget_login'), request.form.get('beget_password')))
    db.commit()
    flash('Настройки Beget сохранены', 'success')
    return redirect(url_for('index'))

@app.route('/settings/saby', methods=['POST'])
def save_saby_settings():
    db = get_db()
    db.execute('''CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        smtp_server TEXT, smtp_port TEXT, sender_email TEXT, sender_password TEXT,
        default_report_email TEXT, beget_login TEXT, beget_password TEXT,
        saby_api_key TEXT, saby_org_id TEXT, company_name TEXT, auto_report_interval TEXT
    )''')
    
    existing = db.execute('SELECT id FROM settings LIMIT 1').fetchone()
    if existing:
        db.execute('UPDATE settings SET saby_api_key=?, saby_org_id=? WHERE id=?',
            (request.form.get('saby_api_key'), request.form.get('saby_org_id'), existing['id']))
    else:
        db.execute('INSERT INTO settings (saby_api_key, saby_org_id) VALUES (?, ?)',
            (request.form.get('saby_api_key'), request.form.get('saby_org_id')))
    db.commit()
    flash('Настройки Saby сохранены', 'success')
    return redirect(url_for('index'))

@app.route('/settings/system', methods=['POST'])
def save_system_settings():
    db = get_db()
    db.execute('''CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        smtp_server TEXT, smtp_port TEXT, sender_email TEXT, sender_password TEXT,
        default_report_email TEXT, beget_login TEXT, beget_password TEXT,
        saby_api_key TEXT, saby_org_id TEXT, company_name TEXT, auto_report_interval TEXT
    )''')
    
    existing = db.execute('SELECT id FROM settings LIMIT 1').fetchone()
    if existing:
        db.execute('UPDATE settings SET company_name=?, auto_report_interval=? WHERE id=?',
            (request.form.get('company_name'), request.form.get('auto_report_interval'), existing['id']))
    else:
        db.execute('INSERT INTO settings (company_name, auto_report_interval) VALUES (?, ?)',
            (request.form.get('company_name'), request.form.get('auto_report_interval')))
    db.commit()
    flash('Системные настройки сохранены', 'success')
    return redirect(url_for('index'))

    # Получаем события хостинга из backups.db host_events за период
    host_events = []
    grouped_events = {'domains': [], 'sites': [], 'databases': [], 'mailboxes': [], 'snapshots': [], 'diffs': [], 'others': []}
    try:
        import os, json as _json
        db_path_backups = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backups.db')
        if os.path.exists(db_path_backups):
            conn_b = sqlite3.connect(db_path_backups)
            conn_b.row_factory = sqlite3.Row
            cur_b = conn_b.cursor()
            start_ts = int(datetime.datetime.strptime(date_from, '%Y-%m-%d').timestamp())
            end_ts = int(datetime.datetime.strptime(date_to, '%Y-%m-%d').timestamp()) + 86400
            # client_id may be null — but we filter by client.id when available
            if client_id:
                cur_b.execute('SELECT * FROM host_events WHERE client_id = ? AND event_time BETWEEN ? AND ? ORDER BY event_time DESC', (client_id, start_ts, end_ts))
            else:
                cur_b.execute('SELECT * FROM host_events WHERE event_time BETWEEN ? AND ? ORDER BY event_time DESC', (start_ts, end_ts))
            rows = [dict(r) for r in cur_b.fetchall()]
            for r in rows:
                human = None
                try:
                    human = datetime.datetime.fromtimestamp(r.get('event_time')).strftime('%d.%m.%Y %H:%M:%S') if r.get('event_time') else None
                except Exception:
                    human = None
                details_raw = r.get('details')
                details = None
                try:
                    details = _json.loads(details_raw) if details_raw else None
                except Exception:
                    details = details_raw

                ev = {
                    'id': r.get('id'),
                    'client_id': r.get('client_id'),
                    'host_account': r.get('host_account'),
                    'site': r.get('site'),
                    'event_type': r.get('event_type'),
                    'details': details,
                    'event_time': r.get('event_time'),
                    'human_time': human,
                    'source': r.get('source')
                }

                host_events.append(ev)

                # categorize and create human-friendly description + impact
                desc = ''
                impact = 'Low'
                impact_note = ''
                et = ev['event_type'] or ''
                if et == 'beget_snapshot':
                    grouped_events['snapshots'].append(ev)
                    desc = 'Полный снимок состояния аккаунта Beget'
                elif et in ('domain_created', 'domain_removed'):
                    grouped_events['domains'].append(ev)
                    d = ev.get('details')
                    dom = d.get('domain') if isinstance(d, dict) else d
                    desc = f"Домен: {dom} — {'создан' if 'created' in et else 'удален'}"
                    # impact: удаление домена — высокий
                    impact = 'High' if 'removed' in et else 'Medium'
                    if 'removed' in et:
                        impact_note = 'Домен удалён — возможна потеря почты и доступности сайта.'
                elif et in ('site_created', 'site_removed'):
                    grouped_events['sites'].append(ev)
                    s = ev.get('details')
                    desc = f"Сайт: {s} — {'создан' if 'created' in et else 'удален'}"
                    impact = 'Medium' if 'removed' in et else 'Low'
                elif et in ('db_created', 'db_removed'):
                    grouped_events['databases'].append(ev)
                    d = ev.get('details')
                    dbn = d.get('db') if isinstance(d, dict) else d
                    desc = f"БД: {dbn} — {'создана' if 'created' in et else 'удалена'}"
                    impact = 'High' if 'removed' in et else 'Medium'
                elif et in ('mailbox_created', 'mailbox_removed'):
                    grouped_events['mailboxes'].append(ev)
                    d = ev.get('details')
                    mb = d.get('mailbox') if isinstance(d, dict) else d
                    desc = f"Почтовый ящик: {mb} — {'создан' if 'created' in et else 'удален'}"
                    impact = 'Medium' if 'removed' in et else 'Low'
                elif ev['source'] == 'beget_diff':
                    grouped_events['diffs'].append(ev)
                    desc = 'Изменение: ' + (str(ev.get('details'))[:200])
                else:
                    grouped_events['others'].append(ev)
                    desc = str(ev.get('details'))[:200]

                ev['description'] = desc
                ev['impact'] = impact
                ev['impact_note'] = impact_note

            conn_b.close()
    except Exception as e:
        print(f'Error loading host_events: {e}')

    # Simple additional checks: domain expirations from latest snapshot
    domain_alerts = []
    try:
        # find latest snapshot for client
        latest_snapshot = None
        for s in grouped_events.get('snapshots', []):
            if not latest_snapshot or (s.get('event_time') or 0) > (latest_snapshot.get('event_time') or 0):
                latest_snapshot = s
        if latest_snapshot and isinstance(latest_snapshot.get('details'), dict):
            snap = latest_snapshot.get('details', {}).get('snapshot', {})
            for d in snap.get('domains', []) or []:
                exp = d.get('date_expire')
                fqdn = d.get('fqdn') or d.get('domain')
                if exp:
                    try:
                        exp_dt = datetime.datetime.strptime(exp.split(' ')[0], '%Y-%m-%d').date()
                        days_left = (exp_dt - datetime.date.today()).days
                        if days_left <= 30:
                            domain_alerts.append({'domain': fqdn, 'expires': exp, 'days_left': days_left, 'severity': 'High' if days_left <=7 else 'Medium'})
                    except Exception:
                        pass
    except Exception:
        pass

    # format backups dates into Russian readable form
    import datetime as _dt
    for b in backups:
        bd = b.get('backup_date')
        bd_rus = bd
        try:
            if bd:
                try:
                    dt = _dt.datetime.fromisoformat(bd)
                except Exception:
                    try:
                        dt = _dt.datetime.strptime(bd[:19], '%Y-%m-%d %H:%M:%S')
                    except Exception:
                        dt = None
                if dt:
                    bd_rus = dt.strftime('%d.%m.%Y %H:%M:%S')
        except Exception:
            bd_rus = bd
        b['backup_date_rus'] = bd_rus

    # format report header dates
    date_from_rus = date_from
    date_to_rus = date_to
    try:
        df = _dt.datetime.strptime(date_from, '%Y-%m-%d')
        date_from_rus = df.strftime('%d.%m.%Y')
    except Exception:
        pass
    try:
        dtv = _dt.datetime.strptime(date_to, '%Y-%m-%d')
        date_to_rus = dtv.strftime('%d.%m.%Y')
    except Exception:
        pass

    print(f'[REPORT] client_id={client_id} backups_count={len(backups)} host_events={len(host_events)}')
    return render_template_string(REPORT_TEMPLATE, client=client, logs=logs, backups=backups, beget_status=beget_status, beget_data=beget_data, date_from=date_from_rus, date_to=date_to_rus, host_events=host_events, grouped_events=grouped_events, domain_alerts=domain_alerts)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3002)

