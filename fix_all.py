import re

# Обновляем ядро базы данных
with open("crm_core.py", "w", encoding="utf-8") as f:
    f.write('''import sqlite3

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
''')

# Обновляем маршруты в app.py
with open("app.py", "r", encoding="utf-8") as f:
    code = f.read()

pattern = re.compile(r"@app\.route\(['\"]/client/<int:client_id>/update_beget['\"], methods=\[['\"]POST['\"]\].*?(?=@app\.route|if __name__ ==)", re.DOTALL)
new_func = '''@app.route("/client/<int:client_id>/update_beget", methods=["POST"])
def update_beget(client_id):
    login = request.form.get("login", "").strip()
    password = request.form.get("password", "").strip()
    sites = request.form.get("sites", "").strip()
    emails = request.form.get("emails", "").strip()
    
    try:
        import crm_core
        crm_core.update_client_beget(client_id, login, password, sites, emails)
        if not login or not password:
            flash("Настройки сохранены. Интеграция с хостингом ОТКЛЮЧЕНА (доступы пусты).", "warning")
        else:
            flash("Доступы Beget успешно сохранены и активированы!", "success")
    except Exception as e:
        flash(f"Ошибка при сохранении: {e}", "alert")
        
    return redirect(f"/client/{client_id}")

'''
if "update_beget" in code:
    code = pattern.sub(new_func, code)

# Делаем обращение к базе безопасным (чтобы не падало при пустых полях)
code = code.replace("client['beget_login']", "client.get('beget_login')")
code = code.replace('client["beget_login"]', "client.get('beget_login')")
code = code.replace("client['beget_password']", "client.get('beget_password')")
code = code.replace("client['beget_pass']", "client.get('beget_password')")

with open("app.py", "w", encoding="utf-8") as f:
    f.write(code)
print("Логика ядра успешно обновлена!")
