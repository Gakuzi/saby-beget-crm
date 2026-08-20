#!/usr/bin/env python3
"""
Визуальный тест интеграции с Saby
Запустите этот скрипт для проверки работы веб-интерфейса
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'crm_data.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def add_test_client():
    """Добавляет тестового клиента для проверки интерфейса"""
    db = get_db()
    
    # Проверяем, есть ли уже клиенты
    existing = db.execute('SELECT id FROM clients LIMIT 1').fetchone()
    if existing:
        print(f"✓ В базе уже есть клиенты (ID: {existing['id']})")
        db.close()
        return existing['id']
    
    # Добавляем тестового клиента
    db.execute('''
        INSERT INTO clients (inn, company_name, saby_contract_number, sites, email_reports)
        VALUES (?, ?, ?, ?, ?)
    ''', ('7707083893', 'Тестовая Компания ООО', 'TEST-001', 'test-site.ru', 'test@example.com'))
    
    db.commit()
    client_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    db.close()
    
    print(f"✓ Добавлен тестовый клиент с ID: {client_id}")
    return client_id

def check_saby_tables():
    """Проверяет наличие и структуру таблиц Saby"""
    db = get_db()
    
    tables = {
        'saby_works': ['id', 'client_id', 'document_id', 'work_name', 'work_quantity', 'work_price', 'work_sum'],
        'saby_requests': ['id', 'client_id', 'request_id', 'request_subject', 'request_status'],
        'saby_documents': ['id', 'client_id', 'document_id', 'document_type', 'document_number', 'document_status']
    }
    
    print("\n📊 Проверка таблиц Saby:")
    for table, expected_cols in tables.items():
        cursor = db.execute(f"PRAGMA table_info({table})")
        columns = [col[1] for col in cursor.fetchall()]
        
        if columns:
            missing = set(expected_cols) - set(columns)
            if missing:
                print(f"  ⚠ {table}: отсутствуют колонки {missing}")
            else:
                print(f"  ✓ {table}: все колонки на месте")
        else:
            print(f"  ✗ {table}: таблица не найдена")
    
    db.close()

def main():
    print("=" * 60)
    print("ВИЗУАЛЬНЫЙ ТЕСТ ИНТЕГРАЦИИ С SABY")
    print("=" * 60)
    
    # Проверяем таблицы
    check_saby_tables()
    
    # Добавляем тестового клиента
    print("\n" + "=" * 60)
    client_id = add_test_client()
    
    print("\n" + "=" * 60)
    print("ИНСТРУКЦИЯ ПО ТЕСТИРОВАНИЮ:")
    print("=" * 60)
    print(f"""
1. Запустите Flask-приложение:
   cd /workspace && python3 app.py

2. Откройте в браузере:
   http://localhost:3002

3. Перейдите в карточку клиента (ID: {client_id}):
   http://localhost:3002/client/{client_id}

4. Проверьте вкладки:
   📋 Работы из Saby - нажмите "Синхронизировать с Saby"
   📞 Обращения - должны подгрузиться из СБИС
   📄 Документы - акты и счета из СБИС
   ✏️ Локальные записи - ручное добавление работ

5. API для синхронизации можно проверить командой:
   curl -X POST http://localhost:3002/api/saby/sync/{client_id}

6. Для добавления контрагента через поиск в Saby:
   http://localhost:3002/add_page
   """)
    
    print("=" * 60)
    print("✅ Все готово к тестированию!")
    print("=" * 60)

if __name__ == '__main__':
    main()
