import sqlite3
import os

def get_db_connection():
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_data.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def update_client_beget(client_id, login, password, sites, emails, report_schedule=None):
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
    # some installations have report_frequency column already (legacy). Prefer it.
    use_freq_col = False
    if "report_frequency" in cols:
        use_freq_col = True
    else:
        if "report_schedule" not in cols:
            cursor.execute("ALTER TABLE clients ADD COLUMN report_schedule TEXT;")
    if "last_report_sent" not in cols:
        cursor.execute("ALTER TABLE clients ADD COLUMN last_report_sent TEXT;")

    if use_freq_col:
        cursor.execute("UPDATE clients SET beget_login = ?, beget_password = ?, sites = ?, email_reports = ?, report_frequency = ? WHERE id = ?", (login, password, sites, emails, report_schedule, client_id))
    else:
        cursor.execute("UPDATE clients SET beget_login = ?, beget_password = ?, sites = ?, email_reports = ?, report_schedule = ? WHERE id = ?", (login, password, sites, emails, report_schedule, client_id))
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
