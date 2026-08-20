#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Модуль интеграции с Saby API для ежедневной синхронизации
Данные: договоры, работы, услуги, обращения, документы (акты, счета)
"""

import json
import requests
import os
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple

CONFIG_PATH = "/opt/backup-reports/.saby_config"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_data.db')

# ============================================================================
# КОНФИГУРАЦИЯ И АВТОРИЗАЦИЯ
# ============================================================================

def get_db_connection():
    """Получение соединения с базой данных"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_saby_tables():
    """Инициализация таблиц для хранения данных из Saby"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Создаем таблицу clients если нет
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inn TEXT,
            company_name TEXT,
            email_reports TEXT,
            sites TEXT,
            saby_contract_id TEXT,
            saby_contract_number TEXT,
            beget_login TEXT,
            beget_password TEXT,
            saby_inn TEXT
        )
    """)
    
    # Таблица для рабочих логов
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS work_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            description TEXT,
            hours REAL,
            work_date DATE
        )
    """)
    
    # Таблица для синхронизированных работ/услуг из актов
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saby_works (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            document_id TEXT,
            document_number TEXT,
            document_date TEXT,
            work_name TEXT,
            work_quantity REAL,
            work_unit TEXT,
            work_price REAL,
            work_sum REAL,
            act_number TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(document_id, work_name)
        )
    """)
    
    # Таблица для обращений/задач из СБИС
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saby_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            request_id TEXT,
            request_number TEXT,
            request_date TEXT,
            request_status TEXT,
            request_subject TEXT,
            request_description TEXT,
            executor TEXT,
            closed_date TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(request_id)
        )
    """)
    
    # Таблица для документов (акты, счета)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saby_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            document_id TEXT,
            document_type TEXT,
            document_number TEXT,
            document_date TEXT,
            document_sum REAL,
            document_status TEXT,
            document_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(document_id)
        )
    """)
    
    # Таблица логов синхронизации
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            sync_type TEXT,
            records_count INTEGER,
            status TEXT,
            error_message TEXT
        )
    """)
    
    # Добавляем колонки в clients если нет
    cols = [col[1] for col in cursor.execute("PRAGMA table_info(clients)").fetchall()]
    if "saby_inn" not in cols:
        cursor.execute("ALTER TABLE clients ADD COLUMN saby_inn TEXT;")
    
    conn.commit()
    conn.close()

def get_saby_token(logs: List[str]) -> Optional[str]:
    """Получение токена доступа к Saby API"""
    if not os.path.exists(CONFIG_PATH):
        logs.append(f"Ошибка: файл {CONFIG_PATH} не найден")
        return None
    
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        
        url = "https://online.sbis.ru/oauth/service/"
        payload = {
            "app_client_id": cfg.get("app_client_id"),
            "app_secret": cfg.get("app_secret"),
            "secret_key": cfg.get("secret_key")
        }
        resp = requests.post(url, json=payload, timeout=15)
        res = resp.json()
        token = res.get("token")
        if not token:
            logs.append(f"Ошибка получения токена: {resp.text}")
            return None
        logs.append("✓ Токен доступа успешно получен")
        return token
    except Exception as e:
        logs.append(f"✗ Исключение при авторизации: {str(e)}")
        return None

def make_saby_request(method: str, params: Dict, token: str, logs: List[str]) -> Optional[Dict]:
    """Вызов метода Saby API через RPC"""
    try:
        api_url = "https://online.sbis.ru/service/sbis-rpc.service"
        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "X-SBISAccessToken": token
        }
        
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": 1
        }
        
        resp = requests.post(api_url, json=payload, headers=headers, timeout=30)
        result = resp.json()
        
        if "error" in result:
            error_msg = result["error"].get("message", "Неизвестная ошибка")
            logs.append(f"✗ Ошибка API {method}: {error_msg}")
            return None
        
        return result.get("result")
    
    except Exception as e:
        logs.append(f"✗ Исключение при вызове {method}: {str(e)}")
        return None

# ============================================================================
# ПОЛУЧЕНИЕ ДАННЫХ ИЗ SABY
# ============================================================================

def get_saby_contracts_by_inn(inn: str, token: str, logs: List[str]) -> List[Dict]:
    """Получение списка договоров по ИНН"""
    contractor_obj = {"СвЮЛ": {"ИНН": inn}} if len(inn) == 10 else {"СвФЛ": {"ИНН": inn}}
    found_docs = []
    
    # Запрос по регламенту аутсорсинга
    payload = {
        "Фильтр": {
            "Тип": "ДоговорИсх",
            "Регламент": {"Название": "Оказания услуг (Аутсорсинг) с кабинетом"},
            "Контрагент": contractor_obj,
            "Навигация": {"РазмерСтраницы": "100", "Страница": "0"}
        }
    }
    
    result = make_saby_request("СБИС.СписокДокументов", payload, token, logs)
    if result:
        docs = result.get("Документ", [])
        if isinstance(docs, dict):
            docs = [docs]
        for d in docs:
            found_docs.append({
                "id": d.get("Идентификатор", ""),
                "number": d.get("Номер", "б/н"),
                "title": d.get("Примечание", d.get("Название", "Договор аутсорсинга")),
                "date": d.get("Дата", ""),
                "sum": d.get("Сумма", "0"),
                "inn": inn
            })
    
    if found_docs:
        logs.append(f"✓ Найдено договоров: {len(found_docs)}")
    else:
        logs.append("⚠ Договоров по регламенту не найдено")
    
    return found_docs

def get_saby_acts_by_contract(contract_id: str, token: str, logs: List[str]) -> List[Dict]:
    """Получение актов выполненных работ по договору с полными статусами"""
    acts = []
    
    payload = {
        "Фильтр": {
            "Тип": "АктИсх",
            "Основание": {"@ref": contract_id},
            "Навигация": {"РазмерСтраницы": "100", "Страница": "0"}
        }
    }
    
    result = make_saby_request("СБИС.СписокДокументов", payload, token, logs)
    if result:
        docs = result.get("Документ", [])
        if isinstance(docs, dict):
            docs = [docs]
        for d in docs:
            state = d.get("Состояние", {})
            # Определяем статус подписания
            sign_status = "Не подписан"
            if isinstance(state, dict):
                status_name = state.get("Наименование", "")
                if "Подписан" in status_name or "Завершен" in status_name:
                    sign_status = "Подписан"
                elif "Отправлен" in status_name:
                    sign_status = "Отправлен, ожидает подписания"
                elif "Черновик" in status_name or "Чернов" in status_name:
                    sign_status = "Черновик"
            
            acts.append({
                "id": d.get("Идентификатор", ""),
                "number": d.get("Номер", ""),
                "date": d.get("Дата", ""),
                "sum": d.get("Сумма", "0"),
                "status_code": d.get("Состояние", {}),
                "status_name": state.get("Наименование", "") if isinstance(state, dict) else "",
                "sign_status": sign_status,
                "is_signed": "Подписан" in sign_status
            })
    
    logs.append(f"✓ Найдено актов: {len(acts)}")
    return acts

def get_act_details(act_id: str, token: str, logs: List[str]) -> List[Dict]:
    """Получение детализации работ из акта"""
    works = []
    
    payload = {
        "Документ": {"@ref": act_id}
    }
    
    result = make_saby_request("СБИС.Документ.Получить", payload, token, logs)
    if result:
        # Получаем табличную часть с услугами
        services = result.get("Услуги", [])
        if isinstance(services, dict):
            services = [services]
        
        for svc in services:
            works.append({
                "name": svc.get("Наименование", ""),
                "quantity": svc.get("Количество", 1),
                "unit": svc.get("ЕдИзмерения", ""),
                "price": svc.get("Цена", 0),
                "sum": svc.get("Сумма", 0)
            })
    
    return works

def get_saby_requests(inn: str, token: str, logs: List[str], days_back: int = 30) -> List[Dict]:
    """Получение обращений/задач от клиента"""
    requests_list = []
    date_from = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    
    # Поиск задач по контрагенту
    payload = {
        "Фильтр": {
            "Тип": "Задача",
            "Контрагент": {"СвЮЛ": {"ИНН": inn}} if len(inn) == 10 else {"СвФЛ": {"ИНН": inn}},
            "ДатаС": date_from,
            "Навигация": {"РазмерСтраницы": "100", "Страница": "0"}
        }
    }
    
    result = make_saby_request("СБИС.СписокДокументов", payload, token, logs)
    if result:
        tasks = result.get("Документ", [])
        if isinstance(tasks, dict):
            tasks = [tasks]
        for t in tasks:
            requests_list.append({
                "id": t.get("Идентификатор", ""),
                "number": t.get("Номер", ""),
                "date": t.get("Дата", ""),
                "subject": t.get("Тема", t.get("Название", "")),
                "description": t.get("Содержание", ""),
                "status": t.get("Состояние", {}).get("Наименование", ""),
                "executor": t.get("Ответственный", {}).get("Наименование", "")
            })
    
    logs.append(f"✓ Найдено обращений: {len(requests_list)}")
    return requests_list

def get_saby_invoices(inn: str, token: str, logs: List[str], days_back: int = 90) -> List[Dict]:
    """Получение счетов на оплату"""
    invoices = []
    date_from = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    
    payload = {
        "Фильтр": {
            "Тип": "СчетФ",
            "Контрагент": {"СвЮЛ": {"ИНН": inn}} if len(inn) == 10 else {"СвФЛ": {"ИНН": inn}},
            "ДатаС": date_from,
            "Навигация": {"РазмерСтраницы": "100", "Страница": "0"}
        }
    }
    
    result = make_saby_request("СБИС.СписокДокументов", payload, token, logs)
    if result:
        docs = result.get("Документ", [])
        if isinstance(docs, dict):
            docs = [docs]
        for d in docs:
            invoices.append({
                "id": d.get("Идентификатор", ""),
                "number": d.get("Номер", ""),
                "date": d.get("Дата", ""),
                "sum": d.get("Сумма", 0),
                "status": d.get("Состояние", {}).get("Наименование", "")
            })
    
    logs.append(f"✓ Найдено счетов: {len(invoices)}")
    return invoices

# ============================================================================
# СОХРАНЕНИЕ ДАННЫХ В БАЗУ
# ============================================================================

def save_saby_works(client_id: int, contract_id: str, token: str, logs: List[str]) -> int:
    """Сохранение работ из актов в базу"""
    saved_count = 0
    acts = get_saby_acts_by_contract(contract_id, token, logs)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    for act in acts:
        works = get_act_details(act["id"], token, logs)
        for work in works:
            try:
                cursor.execute("""
                    INSERT OR REPLACE INTO saby_works 
                    (client_id, document_id, document_number, document_date, 
                     work_name, work_quantity, work_unit, work_price, work_sum, act_number)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    client_id,
                    act["id"],
                    act["number"],
                    act["date"],
                    work["name"],
                    work["quantity"],
                    work["unit"],
                    work["price"],
                    work["sum"],
                    act["number"]
                ))
                saved_count += 1
            except Exception as e:
                logs.append(f"⚠ Ошибка сохранения работы: {str(e)}")
    
    conn.commit()
    conn.close()
    logs.append(f"✓ Сохранено работ: {saved_count}")
    return saved_count

def save_saby_requests(client_id: int, inn: str, token: str, logs: List[str]) -> int:
    """Сохранение обращений в базу"""
    saved_count = 0
    requests_list = get_saby_requests(inn, token, logs)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    for req in requests_list:
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO saby_requests 
                (client_id, request_id, request_number, request_date, 
                 request_status, request_subject, request_description, executor)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                client_id,
                req["id"],
                req["number"],
                req["date"],
                req["status"],
                req["subject"],
                req["description"],
                req["executor"]
            ))
            saved_count += 1
        except Exception as e:
            logs.append(f"⚠ Ошибка сохранения обращения: {str(e)}")
    
    conn.commit()
    conn.close()
    logs.append(f"✓ Сохранено обращений: {saved_count}")
    return saved_count

def save_saby_documents(client_id: int, contract_id: str, inn: str, token: str, logs: List[str]) -> int:
    """Сохранение документов (акты и счета) в базу с полными статусами"""
    saved_count = 0
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Сохраняем акты по договору
    if contract_id:
        acts = get_saby_acts_by_contract(contract_id, token, logs)
        for act in acts:
            try:
                cursor.execute("""
                    INSERT OR REPLACE INTO saby_documents 
                    (client_id, document_id, document_type, document_number, 
                     document_date, document_sum, document_status, document_url)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    client_id,
                    act["id"],
                    "Акт",
                    act["number"],
                    act["date"],
                    float(act["sum"]) if act["sum"] else 0,
                    act.get("sign_status", "Не подписан"),
                    f"https://online.sbis.ru/document/{act['id']}"
                ))
                saved_count += 1
            except Exception as e:
                logs.append(f"⚠ Ошибка сохранения акта: {str(e)}")
    
    # Сохраняем счета по ИНН
    invoices = get_saby_invoices(inn, token, logs)
    for inv in invoices:
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO saby_documents 
                (client_id, document_id, document_type, document_number, 
                 document_date, document_sum, document_status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                client_id,
                inv["id"],
                "Счет",
                inv["number"],
                inv["date"],
                inv["sum"],
                inv["status"]
            ))
            saved_count += 1
        except Exception as e:
            logs.append(f"⚠ Ошибка сохранения документа: {str(e)}")
    
    conn.commit()
    conn.close()
    logs.append(f"✓ Сохранено документов: {saved_count}")
    return saved_count

def log_sync(sync_type: str, records_count: int, status: str, error_message: str = None):
    """Запись лога синхронизации"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO sync_log (sync_type, records_count, status, error_message)
        VALUES (?, ?, ?, ?)
    """, (sync_type, records_count, status, error_message))
    conn.commit()
    conn.close()

# ============================================================================
# ЕЖЕДНЕВНАЯ СИНХРОНИЗАЦИЯ
# ============================================================================

def run_daily_sync(client_id: int = None) -> Dict:
    """
    Запуск ежедневной синхронизации всех данных из Saby
    Если client_id не указан - синхронизируются все клиенты
    """
    logs = []
    total_records = 0
    start_time = datetime.now()
    
    logs.append("=" * 50)
    logs.append(f"Запуск ежедневной синхронизации Saby: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logs.append("=" * 50)
    
    # Инициализация таблиц
    init_saby_tables()
    
    # Получение токена
    token = get_saby_token(logs)
    if not token:
        log_sync("daily", 0, "error", "Не получен токен Saby")
        return {"success": False, "logs": logs, "records": 0}
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Получение списка клиентов для синхронизации
    if client_id:
        cursor.execute("SELECT id, inn, saby_inn, saby_contract_id FROM clients WHERE id = ?", (client_id,))
    else:
        cursor.execute("SELECT id, inn, saby_inn, saby_contract_id FROM clients WHERE inn IS NOT NULL")
    
    clients = cursor.fetchall()
    conn.close()
    
    logs.append(f"✓ Найдено клиентов для синхронизации: {len(clients)}")
    
    for client in clients:
        cid = client["id"]
        inn = client["saby_inn"] or client["inn"]
        contract_id = client["saby_contract_id"]
        
        logs.append(f"\n--- Клиент ID={cid}, ИНН={inn} ---")
        
        # Синхронизация работ из актов
        if contract_id:
            works_count = save_saby_works(cid, contract_id, token, logs)
            total_records += works_count
        
        # Синхронизация обращений
        req_count = save_saby_requests(cid, inn, token, logs)
        total_records += req_count
        
        # Синхронизация документов (акты и счета)
        doc_count = save_saby_documents(cid, contract_id, inn, token, logs)
        total_records += doc_count
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    logs.append("\n" + "=" * 50)
    logs.append(f"Синхронизация завершена за {duration:.2f} сек.")
    logs.append(f"Всего сохранено записей: {total_records}")
    logs.append("=" * 50)
    
    log_sync("daily", total_records, "success")
    
    return {
        "success": True,
        "logs": logs,
        "records": total_records,
        "duration": duration
    }

# ============================================================================
# API ФУНКЦИИ ДЛЯ WEB-ИНТЕРФЕЙСА
# ============================================================================

def get_client_saby_data(client_id: int) -> Dict:
    """Получение всех данных Saby для клиента"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Работы
    works = cursor.execute("""
        SELECT * FROM saby_works WHERE client_id = ? 
        ORDER BY document_date DESC, document_number DESC
    """, (client_id,)).fetchall()
    
    # Обращения
    requests = cursor.execute("""
        SELECT * FROM saby_requests WHERE client_id = ? 
        ORDER BY request_date DESC
    """, (client_id,)).fetchall()
    
    # Документы
    documents = cursor.execute("""
        SELECT * FROM saby_documents WHERE client_id = ? 
        ORDER BY document_date DESC
    """, (client_id,)).fetchall()
    
    # Логи синхронизации
    sync_logs = cursor.execute("""
        SELECT * FROM sync_log ORDER BY sync_date DESC LIMIT 10
    """,).fetchall()
    
    conn.close()
    
    return {
        "works": [dict(w) for w in works],
        "requests": [dict(r) for r in requests],
        "documents": [dict(d) for d in documents],
        "sync_logs": [dict(s) for s in sync_logs]
    }

def get_saby_report(client_id: int, date_from: str, date_to: str) -> Dict:
    """Формирование отчета по данным Saby за период"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    works = cursor.execute("""
        SELECT work_name, SUM(work_quantity) as total_qty, 
               AVG(work_price) as avg_price, SUM(work_sum) as total_sum
        FROM saby_works 
        WHERE client_id = ? AND document_date BETWEEN ? AND ?
        GROUP BY work_name
    """, (client_id, date_from, date_to)).fetchall()
    
    requests = cursor.execute("""
        SELECT request_status, COUNT(*) as count
        FROM saby_requests 
        WHERE client_id = ? AND request_date BETWEEN ? AND ?
        GROUP BY request_status
    """, (client_id, date_from, date_to)).fetchall()
    
    documents = cursor.execute("""
        SELECT document_type, document_status, COUNT(*) as count, SUM(document_sum) as total_sum
        FROM saby_documents 
        WHERE client_id = ? AND document_date BETWEEN ? AND ?
        GROUP BY document_type, document_status
    """, (client_id, date_from, date_to)).fetchall()
    
    conn.close()
    
    return {
        "works": [dict(w) for w in works],
        "requests_stats": [dict(r) for r in requests],
        "documents_stats": [dict(d) for d in documents]
    }

def test_saby_connection(client_id: int) -> Dict:
    """
    Тестирование соединения с Saby API для конкретного клиента
    Проверяет доступность API, получение токена и возможность получения данных по клиенту
    """
    logs = []
    result = {"success": False, "steps": [], "error": None}
    
    conn = get_db_connection()
    cursor = conn.cursor()
    client = cursor.execute("SELECT id, inn, saby_inn, saby_contract_id, company_name FROM clients WHERE id = ?", (client_id,)).fetchone()
    conn.close()
    
    if not client:
        return {"success": False, "error": "Клиент не найден", "logs": ["Клиент не найден в базе"]}
    
    inn = client["saby_inn"] or client["inn"]
    contract_id = client["saby_contract_id"]
    
    logs.append(f"Тестирование соединения для клиента: {client['company_name']} (ИНН: {inn})")
    
    # Шаг 1: Проверка конфигурации
    if not os.path.exists(CONFIG_PATH):
        logs.append(f"✗ Файл конфигурации {CONFIG_PATH} не найден")
        result["steps"].append({"step": "Конфигурация", "status": "error", "message": f"Файл {CONFIG_PATH} не найден"})
        result["logs"] = logs
        return result
    
    logs.append("✓ Файл конфигурации найден")
    result["steps"].append({"step": "Конфигурация", "status": "success", "message": "Файл конфигурации найден"})
    
    # Шаг 2: Получение токена
    token = get_saby_token(logs)
    if not token:
        result["steps"].append({"step": "Авторизация", "status": "error", "message": "Не удалось получить токен"})
        result["logs"] = logs
        result["error"] = "Не удалось получить токен Saby"
        return result
    
    logs.append("✓ Токен получен успешно")
    result["steps"].append({"step": "Авторизация", "status": "success", "message": "Токен получен успешно"})
    
    # Шаг 3: Проверка данных по ИНН (договоры)
    contracts = get_saby_contracts_by_inn(inn, token, logs)
    if contracts:
        logs.append(f"✓ Найдено договоров: {len(contracts)}")
        result["steps"].append({
            "step": "Поиск договоров", 
            "status": "success", 
            "message": f"Найдено договоров: {len(contracts)}",
            "data": contracts[:3]  # Первые 3 договора
        })
    else:
        logs.append("⚠ Договоры не найдены")
        result["steps"].append({"step": "Поиск договоров", "status": "warning", "message": "Договоры не найдены"})
    
    # Шаг 4: Проверка актов по договору (если есть contract_id)
    if contract_id:
        acts = get_saby_acts_by_contract(contract_id, token, logs)
        if acts:
            logs.append(f"✓ Найдено актов: {len(acts)}")
            signed_count = sum(1 for a in acts if a.get("is_signed", False))
            result["steps"].append({
                "step": "Проверка актов", 
                "status": "success", 
                "message": f"Найдено актов: {len(acts)}, подписано: {signed_count}",
                "data": [{"number": a["number"], "date": a["date"], "sign_status": a["sign_status"]} for a in acts[:5]]
            })
        else:
            logs.append("⚠ Акты не найдены")
            result["steps"].append({"step": "Проверка актов", "status": "warning", "message": "Акты не найдены"})
    else:
        logs.append("⚠ ID договора не указан у клиента")
        result["steps"].append({"step": "Проверка актов", "status": "info", "message": "ID договора не указан"})
    
    # Шаг 5: Проверка обращений
    requests_list = get_saby_requests(inn, token, logs, days_back=30)
    if requests_list:
        logs.append(f"✓ Найдено обращений за 30 дней: {len(requests_list)}")
        result["steps"].append({
            "step": "Проверка обращений", 
            "status": "success", 
            "message": f"Найдено обращений: {len(requests_list)}"
        })
    else:
        logs.append("ℹ Обращений за 30 дней не найдено")
        result["steps"].append({"step": "Проверка обращений", "status": "info", "message": "Обращений не найдено"})
    
    result["success"] = True
    result["logs"] = logs
    result["client_info"] = {
        "id": client["id"],
        "company_name": client["company_name"],
        "inn": inn,
        "contract_id": contract_id
    }
    
    return result


if __name__ == "__main__":
    # Тестовый запуск синхронизации
    result = run_daily_sync()
    print("\n".join(result["logs"]))
    print(f"\nИтого записей: {result['records']}")
