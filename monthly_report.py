import sqlite3
import datetime

db_path = "/opt/backup-reports/backups.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Получаем текущий месяц (например, '2026-08')
current_month = datetime.datetime.now().strftime("%Y-%m")

print(f"=== ОТЧЕТ ПО БЭКАПАМ ЗА МЕСЯЦ: {current_month} ===\n")

cursor.execute("""
    SELECT site_name, COUNT(*), MAX(backup_date), ROUND(AVG(size_mb), 2)
    FROM backup_history
    WHERE backup_date LIKE ?
    GROUP BY site_name
""", (f"{current_month}%",))

rows = cursor.fetchall()
for row in rows:
    print(f"Клиника: {row[0]}")
    print(f"  - Всего зафиксировано бэкапов: {row[1]}")
    print(f"  - Самый свежий бэкап: {row[2]}")
    print(f"  - Средний размер: {row[3]} МБ")
    print("-" * 40)

conn.close()
