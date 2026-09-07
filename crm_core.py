import sqlite3
import os

def get_db_connection():
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_data.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def update_client_beget(client_id, login, password, sites, emails, report_schedule=None, report_sections=None, report_start_day=None, api_key=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cols = [col[1] for col in cursor.execute("PRAGMA table_info(clients)").fetchall()]
    if "beget_login" not in cols:
        cursor.execute("ALTER TABLE clients ADD COLUMN beget_login TEXT;")
    if "beget_password" not in cols:
        cursor.execute("ALTER TABLE clients ADD COLUMN beget_password TEXT;")
    if "beget_api_key" not in cols:
        cursor.execute("ALTER TABLE clients ADD COLUMN beget_api_key TEXT;")
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
    if "report_sections" not in cols:
        cursor.execute("ALTER TABLE clients ADD COLUMN report_sections TEXT;")
    if "report_start_day" not in cols:
        cursor.execute("ALTER TABLE clients ADD COLUMN report_start_day INTEGER;")

    # encrypt password before storing
    try:
        import crypto_util
        enc_password = crypto_util.encrypt_text(password) if password else password
    except Exception:
        enc_password = password

    if use_freq_col:
        cursor.execute("UPDATE clients SET beget_login = ?, beget_password = ?, beget_api_key = ?, sites = ?, email_reports = ?, report_frequency = ?, report_sections = ?, report_start_day = ? WHERE id = ?", (login, enc_password, api_key, sites, emails, report_schedule, report_sections, report_start_day, client_id))
    else:
        cursor.execute("UPDATE clients SET beget_login = ?, beget_password = ?, beget_api_key = ?, sites = ?, email_reports = ?, report_schedule = ?, report_sections = ?, report_start_day = ? WHERE id = ?", (login, enc_password, api_key, sites, emails, report_schedule, report_sections, report_start_day, client_id))
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

def add_work_log_with_date(client_id, description, hours, work_date):
    conn = get_db_connection()
    cursor = conn.cursor()
    # work_date expected as 'YYYY-MM-DD' or full datetime
    cursor.execute("""
        INSERT INTO work_logs (client_id, description, hours, work_date)
        VALUES (?, ?, ?, ?)
    """, (client_id, description, hours, work_date))
    conn.commit()
    conn.close()

def update_work_log(log_id, description, hours, work_date):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE work_logs SET description = ?, hours = ?, work_date = ? WHERE id = ?
    """, (description, hours, work_date, log_id))
    conn.commit()
    conn.close()

def delete_work_log(log_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM work_logs WHERE id = ?", (log_id,))
    conn.commit()
    conn.close()
