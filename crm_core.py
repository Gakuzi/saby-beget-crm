import sqlite3

def get_db_connection():
    conn = sqlite3.connect("backups.db")
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
    
    cursor.execute("UPDATE clients SET beget_login = ?, beget_password = ?, sites = ?, emails = ? WHERE id = ?", (login, password, sites, emails, client_id))
    conn.commit()
    conn.close()
