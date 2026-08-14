import sqlite3
import os

def get_db_connection():
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_data.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def update_client_beget(client_id, login, password, sites, emails):
    conn = get_db_connection()
    cursor = conn.cursor()
    cols = [col[1] for col in cursor.execute("PRAGMA table_info(clients)").fetchall()]
    if "beget_login" not in cols:
        cursor.execute("ALTER TABLE clients ADD COLUMN beget_login TEXT;")
    if "beget_password" not in cols:
        cursor.execute("ALTER TABLE clients ADD COLUMN beget_password TEXT;")
    if "sites" not in cols:
        cursor.execute("ALTER TABLE clients ADD COLUMN sites TEXT;")
    if "email_reports" not in cols:
        cursor.execute("ALTER TABLE clients ADD COLUMN email_reports TEXT;")
    
    cursor.execute("UPDATE clients SET beget_login = ?, beget_password = ?, sites = ?, email_reports = ? WHERE id = ?", (login, password, sites, emails, client_id))
    conn.commit()
    conn.close()

def add_client(inn, company_name, email_reports, sites, saby_contract_id, saby_contract_number):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO clients (inn, company_name, email_reports, sites, saby_contract_id, saby_contract_number)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (inn, company_name, email_reports, sites, saby_contract_id, saby_contract_number))
    conn.commit()
    conn.close()

def add_work_log(client_id, description, hours):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO work_logs (client_id, description, hours, work_date)
        VALUES (?, ?, ?, DATE('now'))
    """, (client_id, description, hours))
    conn.commit()
    conn.close()
