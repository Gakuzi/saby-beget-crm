import sqlite3
import os

def init_database():
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_data.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Таблица клиентов
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inn TEXT UNIQUE,
            company_name TEXT,
            email_reports TEXT,
            sites TEXT,
            saby_contract_id TEXT,
            saby_contract_number TEXT,
            beget_login TEXT,
            beget_password TEXT,
            beget_api_key TEXT,
            report_schedule TEXT,
            last_report_sent TEXT,
            report_sections TEXT,
            report_start_day INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Таблица рабочих логов
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS work_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            description TEXT,
            hours REAL,
            work_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients(id)
        )
    """)
    
    # Таблица настроек
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()
    print("База данных успешно инициализирована!")

if __name__ == "__main__":
    init_database()
