#!/usr/bin/env python3
"""
Визуальный интерфейс для тестирования интеграции с Saby
Запуск: python3 saby_visual_test.py
Откройте в браузере: http://localhost:8080
"""

import sys
import os
import json
import sqlite3
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse

# Добавляем текущую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Импортируем модуль интеграции
try:
    from saby_integration import SabyIntegration
    SABY_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Модуль saby_integration не найден: {e}")
    SABY_AVAILABLE = False

# Путь к базе данных
DB_PATH = "./test_crm.db"

def get_db_connection():
    """Подключение к базе данных"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_test_db():
    """Инициализация тестовой базы данных"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Таблица клиентов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inn TEXT UNIQUE,
            company_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Таблица договоров из Saby
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS saby_contracts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            contract_id TEXT,
            contract_number TEXT,
            start_date TEXT,
            end_date TEXT,
            status TEXT,
            raw_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id)
        )
    ''')
    
    # Таблица работ
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS saby_works (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contract_id TEXT,
            work_name TEXT,
            quantity REAL,
            price REAL,
            total REAL,
            unit TEXT,
            act_date TEXT,
            raw_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Таблица обращений
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS saby_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT,
            title TEXT,
            status TEXT,
            created_date TEXT,
            completed_date TEXT,
            executor TEXT,
            raw_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Таблица логов синхронизации
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sync_type TEXT,
            status TEXT,
            message TEXT,
            records_count INTEGER,
            sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ База данных инициализирована")

class SabyTestHandler(SimpleHTTPRequestHandler):
    """Обработчик HTTP запросов для визуального теста"""
    
    def do_GET(self):
        """Обработка GET запросов"""
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        if path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(self.get_main_page().encode('utf-8'))
        
        elif path == '/api/contracts':
            self.send_json_response(self.get_contracts())
        
        elif path == '/api/works':
            self.send_json_response(self.get_works())
        
        elif path == '/api/requests':
            self.send_json_response(self.get_requests())
        
        elif path == '/api/sync':
            self.send_json_response(self.run_sync())
        
        elif path == '/api/test-connection':
            self.send_json_response(self.test_connection())
        
        else:
            super().do_GET()
    
    def do_POST(self):
        """Обработка POST запросов"""
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        if self.path == '/api/add-client':
            result = self.add_client(data)
            self.send_json_response(result)
        
        elif self.path == '/api/sync-client':
            result = self.sync_client(data)
            self.send_json_response(result)
        
        else:
            self.send_error(404, "Not Found")
    
    def send_json_response(self, data):
        """Отправка JSON ответа"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def get_main_page(self):
        """Генерация главной страницы"""
        return f'''
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Тест интеграции Saby - CRM</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        h1 {{ color: #333; }}
        .card {{ background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .btn {{ background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }}
        .btn:hover {{ background: #45a049; }}
        .btn-blue {{ background: #2196F3; }}
        .btn-blue:hover {{ background: #1976D2; }}
        .btn-orange {{ background: #FF9800; }}
        .btn-orange:hover {{ background: #F57C00; }}
        input, select {{ padding: 8px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 10px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #f8f9fa; }}
        .status-ok {{ color: green; }}
        .status-error {{ color: red; }}
        .status-warning {{ color: orange; }}
        .log {{ background: #f4f4f4; padding: 10px; border-radius: 4px; font-family: monospace; max-height: 300px; overflow-y: auto; }}
        .tab {{ overflow: hidden; border: 1px solid #ccc; background: #f1f1f1; border-radius: 4px 4px 0 0; }}
        .tab button {{ background: inherit; float: left; border: none; outline: none; cursor: pointer; padding: 14px 16px; transition: 0.3s; }}
        .tab button:hover {{ background: #ddd; }}
        .tab button.active {{ background: #4CAF50; color: white; }}
        .tabcontent {{ display: none; padding: 20px; border: 1px solid #ccc; border-top: none; background: white; border-radius: 0 0 4px 4px; }}
        .spinner {{ border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; display: inline-block; vertical-align: middle; }}
        @keyframes spin {{ 0% {{ transform: rotate(0deg); }} 100% {{ transform: rotate(360deg); }} }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔗 Тест интеграции с Saby</h1>
        
        <div class="card">
            <h2>1. Проверка подключения</h2>
            <button class="btn btn-blue" onclick="testConnection()">🔌 Проверить подключение к Saby</button>
            <div id="connection-result" style="margin-top: 10px;"></div>
        </div>
        
        <div class="card">
            <h2>2. Добавление клиента</h2>
            <input type="text" id="inn-input" placeholder="Введите ИНН организации">
            <input type="text" id="company-name-input" placeholder="Название компании">
            <button class="btn" onclick="addClient()">➕ Добавить клиента</button>
            <div id="add-client-result" style="margin-top: 10px;"></div>
        </div>
        
        <div class="card">
            <h2>3. Синхронизация данных</h2>
            <button class="btn btn-orange" onclick="syncAll()">🔄 Синхронизировать все данные</button>
            <button class="btn btn-orange" onclick="syncClient()">🔄 Синхронизировать выбранного клиента</button>
            <div id="sync-result" style="margin-top: 10px;"></div>
        </div>
        
        <div class="tab">
            <button class="tablinks active" onclick="openTab(event, 'Contracts')">📄 Договоры</button>
            <button class="tablinks" onclick="openTab(event, 'Works')">⚙️ Работы</button>
            <button class="tablinks" onclick="openTab(event, 'Requests')">📞 Обращения</button>
            <button class="tablinks" onclick="openTab(event, 'Logs')">📊 Логи</button>
        </div>
        
        <div id="Contracts" class="tabcontent" style="display: block;">
            <h3>Договоры из Saby</h3>
            <button class="btn btn-blue" onclick="loadContracts()">🔄 Обновить</button>
            <table id="contracts-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Номер</th>
                        <th>Даты</th>
                        <th>Статус</th>
                        <th>Создан</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
        
        <div id="Works" class="tabcontent">
            <h3>Выполненные работы</h3>
            <button class="btn btn-blue" onclick="loadWorks()">🔄 Обновить</button>
            <table id="works-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Наименование</th>
                        <th>Кол-во</th>
                        <th>Цена</th>
                        <th>Сумма</th>
                        <th>Дата акта</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
        
        <div id="Requests" class="tabcontent">
            <h3>Обращения клиентов</h3>
            <button class="btn btn-blue" onclick="loadRequests()">🔄 Обновить</button>
            <table id="requests-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Заголовок</th>
                        <th>Статус</th>
                        <th>Дата создания</th>
                        <th>Исполнитель</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
        
        <div id="Logs" class="tabcontent">
            <h3>Логи синхронизации</h3>
            <button class="btn btn-blue" onclick="loadLogs()">🔄 Обновить</button>
            <div id="logs-container" class="log"></div>
        </div>
    </div>
    
    <script>
        function openTab(evt, tabName) {{
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tabcontent");
            for (i = 0; i < tabcontent.length; i++) {{
                tabcontent[i].style.display = "none";
            }}
            tablinks = document.getElementsByClassName("tablinks");
            for (i = 0; i < tablinks.length; i++) {{
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }}
            document.getElementById(tabName).style.display = "block";
            evt.currentTarget.className += " active";
        }}
        
        async function testConnection() {{
            const resultDiv = document.getElementById('connection-result');
            resultDiv.innerHTML = '<div class="spinner"></div> Проверка...';
            
            try {{
                const response = await fetch('/api/test-connection');
                const data = await response.json();
                
                if (data.success) {{
                    resultDiv.innerHTML = '<p class="status-ok">✅ Подключение успешно! Токен получен.</p>' +
                                         '<p><small>Токен: ' + data.token.substring(0, 20) + '...</small></p>';
                }} else {{
                    resultDiv.innerHTML = '<p class="status-error">❌ Ошибка: ' + data.error + '</p>';
                }}
            }} catch (error) {{
                resultDiv.innerHTML = '<p class="status-error">❌ Ошибка соединения: ' + error.message + '</p>';
            }}
        }}
        
        async function addClient() {{
            const inn = document.getElementById('inn-input').value;
            const companyName = document.getElementById('company-name-input').value;
            const resultDiv = document.getElementById('add-client-result');
            
            if (!inn) {{
                resultDiv.innerHTML = '<p class="status-error">❌ Введите ИНН</p>';
                return;
            }}
            
            try {{
                const response = await fetch('/api/add-client', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/json'}},
                    body: JSON.stringify({{ inn, company_name: companyName }})
                }});
                const data = await response.json();
                
                if (data.success) {{
                    resultDiv.innerHTML = '<p class="status-ok">✅ Клиент добавлен! ID: ' + data.client_id + '</p>';
                    loadContracts();
                }} else {{
                    resultDiv.innerHTML = '<p class="status-error">❌ Ошибка: ' + data.error + '</p>';
                }}
            }} catch (error) {{
                resultDiv.innerHTML = '<p class="status-error">❌ Ошибка: ' + error.message + '</p>';
            }}
        }}
        
        async function syncClient() {{
            const inn = document.getElementById('inn-input').value;
            const resultDiv = document.getElementById('sync-result');
            
            if (!inn) {{
                resultDiv.innerHTML = '<p class="status-warning">⚠️ Введите ИНН для синхронизации</p>';
                return;
            }}
            
            resultDiv.innerHTML = '<div class="spinner"></div> Синхронизация...';
            
            try {{
                const response = await fetch('/api/sync-client', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/json'}},
                    body: JSON.stringify({{ inn }})
                }});
                const data = await response.json();
                
                if (data.success) {{
                    resultDiv.innerHTML = '<p class="status-ok">✅ Синхронизация завершена! Найдено договоров: ' + 
                                         (data.contracts || 0) + ', работ: ' + (data.works || 0) + 
                                         ', обращений: ' + (data.requests || 0) + '</p>';
                    loadContracts();
                    loadWorks();
                    loadRequests();
                    loadLogs();
                }} else {{
                    resultDiv.innerHTML = '<p class="status-error">❌ Ошибка: ' + data.error + '</p>';
                }}
            }} catch (error) {{
                resultDiv.innerHTML = '<p class="status-error">❌ Ошибка: ' + error.message + '</p>';
            }}
        }}
        
        async function syncAll() {{
            const resultDiv = document.getElementById('sync-result');
            resultDiv.innerHTML = '<div class="spinner"></div> Синхронизация всех данных...';
            
            try {{
                const response = await fetch('/api/sync');
                const data = await response.json();
                
                if (data.success) {{
                    resultDiv.innerHTML = '<p class="status-ok">✅ Синхронизация всех данных завершена!</p>';
                    loadContracts();
                    loadWorks();
                    loadRequests();
                    loadLogs();
                }} else {{
                    resultDiv.innerHTML = '<p class="status-error">❌ Ошибка: ' + data.error + '</p>';
                }}
            }} catch (error) {{
                resultDiv.innerHTML = '<p class="status-error">❌ Ошибка: ' + error.message + '</p>';
            }}
        }}
        
        async function loadContracts() {{
            try {{
                const response = await fetch('/api/contracts');
                const data = await response.json();
                
                const tbody = document.querySelector('#contracts-table tbody');
                tbody.innerHTML = '';
                
                if (data.contracts && data.contracts.length > 0) {{
                    data.contracts.forEach(contract => {{
                        const row = `<tr>
                            <td>${{contract.id}}</td>
                            <td>${{contract.contract_number || 'N/A'}}</td>
                            <td>${{contract.start_date || '-'}} - ${{contract.end_date || '-'}}</td>
                            <td><span class="status-ok">${{contract.status || 'active'}}</span></td>
                            <td>${{contract.created_at}}</td>
                        </tr>`;
                        tbody.innerHTML += row;
                    }});
                }} else {{
                    tbody.innerHTML = '<tr><td colspan="5">Нет данных</td></tr>';
                }}
            }} catch (error) {{
                console.error('Ошибка загрузки договоров:', error);
            }}
        }}
        
        async function loadWorks() {{
            try {{
                const response = await fetch('/api/works');
                const data = await response.json();
                
                const tbody = document.querySelector('#works-table tbody');
                tbody.innerHTML = '';
                
                if (data.works && data.works.length > 0) {{
                    data.works.forEach(work => {{
                        const row = `<tr>
                            <td>${{work.id}}</td>
                            <td>${{work.work_name || 'N/A'}}</td>
                            <td>${{work.quantity}}</td>
                            <td>${{work.price}}</td>
                            <td>${{work.total}}</td>
                            <td>${{work.act_date || '-'}}</td>
                        </tr>`;
                        tbody.innerHTML += row;
                    }});
                }} else {{
                    tbody.innerHTML = '<tr><td colspan="6">Нет данных. Выполните синхронизацию.</td></tr>';
                }}
            }} catch (error) {{
                console.error('Ошибка загрузки работ:', error);
            }}
        }}
        
        async function loadRequests() {{
            try {{
                const response = await fetch('/api/requests');
                const data = await response.json();
                
                const tbody = document.querySelector('#requests-table tbody');
                tbody.innerHTML = '';
                
                if (data.requests && data.requests.length > 0) {{
                    data.requests.forEach(req => {{
                        const row = `<tr>
                            <td>${{req.id}}</td>
                            <td>${{req.title || 'N/A'}}</td>
                            <td><span class="status-ok">${{req.status}}</span></td>
                            <td>${{req.created_date}}</td>
                            <td>${{req.executor || '-'}}</td>
                        </tr>`;
                        tbody.innerHTML += row;
                    }});
                }} else {{
                    tbody.innerHTML = '<tr><td colspan="5">Нет данных. Выполните синхронизацию.</td></tr>';
                }}
            }} catch (error) {{
                console.error('Ошибка загрузки обращений:', error);
            }}
        }}
        
        async function loadLogs() {{
            try {{
                const response = await fetch('/api/contracts'); // Временно используем contracts для примера
                const data = await response.json();
                
                const logsContainer = document.getElementById('logs-container');
                logsContainer.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            }} catch (error) {{
                console.error('Ошибка загрузки логов:', error);
            }}
        }}
        
        // Автозагрузка при старте
        window.onload = function() {{
            loadContracts();
            loadWorks();
            loadRequests();
        }};
    </script>
</body>
</html>
'''
    
    def test_connection(self):
        """Тест подключения к Saby"""
        if not SABY_AVAILABLE:
            return {"success": False, "error": "Модуль saby_integration не доступен"}
        
        try:
            saby = SabyIntegration()
            token = saby.get_token()
            if token:
                return {"success": True, "token": token}
            else:
                return {"success": False, "error": "Не удалось получить токен"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def add_client(self, data):
        """Добавление клиента"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR IGNORE INTO clients (inn, company_name)
                VALUES (?, ?)
            ''', (data.get('inn'), data.get('company_name')))
            
            cursor.execute('SELECT id FROM clients WHERE inn = ?', (data.get('inn'),))
            row = cursor.fetchone()
            
            conn.commit()
            conn.close()
            
            if row:
                return {"success": True, "client_id": row[0]}
            else:
                return {"success": False, "error": "Не удалось добавить клиента"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def sync_client(self, data):
        """Синхронизация конкретного клиента"""
        if not SABY_AVAILABLE:
            return {"success": False, "error": "Модуль saby_integration не доступен"}
        
        try:
            saby = SabyIntegration()
            inn = data.get('inn')
            
            # Поиск организации
            orgs = saby.search_organizations(inn)
            if not orgs:
                return {"success": False, "error": "Организация не найдена"}
            
            # Получаем договоры (упрощенно)
            contracts_count = 0
            works_count = 0
            requests_count = 0
            
            # Здесь должна быть логика синхронизации
            # Для теста просто возвращаем успех
            
            return {
                "success": True,
                "contracts": contracts_count,
                "works": works_count,
                "requests": requests_count
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def run_sync(self):
        """Запуск полной синхронизации"""
        return {"success": True, "message": "Синхронизация запущена"}
    
    def get_contracts(self):
        """Получение списка договоров"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM saby_contracts ORDER BY created_at DESC LIMIT 50')
            rows = cursor.fetchall()
            conn.close()
            
            contracts = [dict(row) for row in rows]
            return {"contracts": contracts}
        except Exception as e:
            return {"error": str(e)}
    
    def get_works(self):
        """Получение списка работ"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM saby_works ORDER BY created_at DESC LIMIT 50')
            rows = cursor.fetchall()
            conn.close()
            
            works = [dict(row) for row in rows]
            return {"works": works}
        except Exception as e:
            return {"error": str(e)}
    
    def get_requests(self):
        """Получение списка обращений"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM saby_requests ORDER BY created_at DESC LIMIT 50')
            rows = cursor.fetchall()
            conn.close()
            
            requests = [dict(row) for row in rows]
            return {"requests": requests}
        except Exception as e:
            return {"error": str(e)}

def main():
    """Запуск сервера"""
    # Инициализация БД
    init_test_db()
    
    # Запуск HTTP сервера
    port = 8080
    server = HTTPServer(('localhost', port), SabyTestHandler)
    print(f"🚀 Сервер запущен на http://localhost:{port}")
    print("📊 Откройте в браузере для тестирования интерфейса")
    print("⚡ Нажмите Ctrl+C для остановки")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Сервер остановлен")
        server.shutdown()

if __name__ == '__main__':
    main()
