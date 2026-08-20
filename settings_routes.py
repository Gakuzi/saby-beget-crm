# Маршруты для управления настройками CRM
from flask import jsonify, request

def register_settings_routes(app):
    @app.route('/api/settings', methods=['GET'])
    def get_settings():
        import sqlite3, os
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_data.db')
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute('SELECT key, value FROM settings').fetchall()
        conn.close()
        settings = {row['key']: row['value'] for row in rows}
        return jsonify(settings)

    @app.route('/api/settings/email', methods=['POST'])
    def save_email_settings():
        import sqlite3, os
        data = request.json
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_data.db')
        conn = sqlite3.connect(db_path)
        settings = [
            ('smtp_host', data.get('smtp_host', '')),
            ('smtp_port', str(data.get('smtp_port', 587))),
            ('smtp_user', data.get('smtp_user', '')),
            ('smtp_password', data.get('smtp_password', '')),
            ('email_from', data.get('email_from', '')),
            ('email_reports_default', data.get('email_reports_default', ''))
        ]
        for key, value in settings:
            conn.execute('''
                INSERT OR REPLACE INTO settings (key, value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
            ''', (key, value))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

    @app.route('/api/settings/beget', methods=['POST'])
    def save_beget_settings():
        import sqlite3, os
        data = request.json
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_data.db')
        conn = sqlite3.connect(db_path)
        settings = [
            ('beget_login', data.get('beget_login', '')),
            ('beget_password', data.get('beget_password', ''))
        ]
        for key, value in settings:
            conn.execute('''
                INSERT OR REPLACE INTO settings (key, value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
            ''', (key, value))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

    @app.route('/api/settings/saby', methods=['POST'])
    def save_saby_settings():
        import sqlite3, os
        data = request.json
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_data.db')
        conn = sqlite3.connect(db_path)
        settings = [
            ('saby_api_key', data.get('saby_api_key', '')),
            ('saby_org_id', data.get('saby_org_id', '')),
            ('saby_service_key', data.get('saby_service_key', ''))
        ]
        for key, value in settings:
            conn.execute('''
                INSERT OR REPLACE INTO settings (key, value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
            ''', (key, value))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

    @app.route('/api/settings/system', methods=['POST'])
    def save_system_settings():
        import sqlite3, os
        data = request.json
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_data.db')
        conn = sqlite3.connect(db_path)
        settings = [
            ('company_name', data.get('company_name', '')),
            ('auto_report_interval', str(data.get('auto_report_interval', '24'))),
            ('timezone', data.get('timezone', 'Europe/Moscow'))
        ]
        for key, value in settings:
            conn.execute('''
                INSERT OR REPLACE INTO settings (key, value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
            ''', (key, value))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
