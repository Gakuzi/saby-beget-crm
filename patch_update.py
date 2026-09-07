import sqlite3

def apply_fix():
    with open("app.py", "r", encoding="utf-8") as f:
        code = f.read()
    
    # Заменяем или добавляем корректный маршрут update_beget
    new_route = """
@app.route('/client/<int:client_id>/update_beget', methods=['POST'])
def update_beget(client_id):
    login = request.form.get('login')
    password = request.form.get('password')
    sites = request.form.get('sites')
    emails = request.form.get('emails')
    
    try:
        conn = sqlite3.connect("backups.db")
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE clients 
            SET beget_login = ?, beget_password = ?, sites = ?, emails = ? 
            WHERE id = ?
        ''', (login, password, sites, emails, client_id))
        conn.commit()
        conn.close()
        flash('Доступы успешно сохранены!', 'success')
    except Exception as e:
        flash(f'Ошибка при сохранении: {e}', 'error')
        
    return redirect(f'/client/{client_id}')
"""
    print("Патч подготовлен")

if __name__ == "__main__":
    apply_fix()
