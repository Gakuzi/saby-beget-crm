#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестовый скрипт для проверки интеграции с Saby API
"""

import sys
import os
sys.path.insert(0, '/workspace')

from saby_integration import (
    get_saby_token,
    get_saby_contracts_by_inn,
    get_saby_acts_by_contract,
    get_act_details,
    get_saby_requests,
    get_saby_invoices,
    init_saby_tables,
    get_client_saby_data,
    run_daily_sync
)

def test_token():
    """Тест получения токена"""
    print("=" * 60)
    print("ТЕСТ 1: Получение токена доступа")
    print("=" * 60)
    logs = []
    token = get_saby_token(logs)
    for log in logs:
        print(log)
    
    if token:
        print(f"✓ ТОКЕН ПОЛУЧЕН: {token[:20]}...")
        return token
    else:
        print("✗ ТОКЕН НЕ ПОЛУЧЕН - проверьте настройки в /opt/backup-reports/.saby_config")
        return None

def test_contracts(token):
    """Тест получения договоров"""
    print("\n" + "=" * 60)
    print("ТЕСТ 2: Поиск договоров по ИНН")
    print("=" * 60)
    
    # Тестовый ИНН (замените на реальный)
    test_inn = "7701234567"  # Замените на ваш ИНН
    
    logs = []
    contracts = get_saby_contracts_by_inn(test_inn, token, logs)
    
    for log in logs:
        print(log)
    
    if contracts:
        print(f"\n✓ Найдено договоров: {len(contracts)}")
        for c in contracts:
            print(f"  - №{c['number']} от {c['date']}: {c['title']}")
        return contracts
    else:
        print("\n⚠ Договоры не найдены")
        print("Убедитесь, что:")
        print("  1. Указан правильный ИНН")
        print("  2. В СБИС есть договоры по регламенту 'Аутсорсинг'")
        return []

def test_init_db():
    """Тест инициализации БД"""
    print("\n" + "=" * 60)
    print("ТЕСТ 3: Инициализация базы данных")
    print("=" * 60)
    
    try:
        init_saby_tables()
        print("✓ Таблицы успешно созданы/проверены")
        
        # Проверка структуры
        import sqlite3
        conn = sqlite3.connect('/workspace/crm_data.db')
        cursor = conn.cursor()
        
        tables = cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name LIKE 'saby%' OR name='clients' OR name='sync_log'
        """).fetchall()
        
        print(f"Созданные таблицы: {[t[0] for t in tables]}")
        conn.close()
        return True
    except Exception as e:
        print(f"✗ Ошибка инициализации БД: {e}")
        return False

def test_full_sync():
    """Тест полной синхронизации"""
    print("\n" + "=" * 60)
    print("ТЕСТ 4: Запуск полной синхронизации")
    print("=" * 60)
    
    result = run_daily_sync()
    
    print("\n".join(result['logs'][-10:]))  # Последние 10 строк лога
    print(f"\nИтого записей: {result['records']}")
    print(f"Время выполнения: {result['duration']:.2f} сек")
    
    return result['success']

if __name__ == "__main__":
    print("\n🔍 ТЕСТИРОВАНИЕ ИНТЕГРАЦИИ С SABY\n")
    
    # Тест 1: Токен
    token = test_token()
    
    if not token:
        print("\n❌ Тестирование прервано: нет токена доступа")
        print("\nИНСТРУКЦИЯ:")
        print("1. Откройте файл /opt/backup-reports/.saby_config")
        print("2. Замените placeholder'ы на реальные ключи из личного кабинета СБИС")
        print("3. Запустите тест снова")
        sys.exit(1)
    
    # Тест 2: Договоры (опционально)
    print("\n💡 Для теста договоров укажите реальный ИНН в коде test_saby_integration.py")
    # contracts = test_contracts(token)
    
    # Тест 3: База данных
    db_ok = test_init_db()
    
    # Тест 4: Синхронизация
    if db_ok:
        sync_ok = test_full_sync()
        if sync_ok:
            print("\n✅ Все тесты пройдены успешно!")
        else:
            print("\n⚠ Синхронизация выполнена с ошибками")
    else:
        print("\n❌ Ошибка инициализации БД")
    
    print("\n" + "=" * 60)
    print("СЛЕДУЮЩИЕ ШАГИ:")
    print("=" * 60)
    print("1. Обновите /opt/backup-reports/.saby_config реальными ключами")
    print("2. Добавьте клиентов в CRM через веб-интерфейс")
    print("3. Настройте cron для ежедневной синхронизации:")
    print("   crontab -e")
    print("   0 2 * * * /opt/backup-reports/saby_daily_sync.sh")
    print("=" * 60 + "\n")
