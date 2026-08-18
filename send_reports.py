#!/usr/bin/env python3
"""
send_reports.py
Скрипт для отправки автоматических отчетов клиентам по schedule.
- Читает clients из crm_data.db
- Для каждого клиента с заполненным email_reports и report_schedule != none формирует нужный период:
  - daily: вчера
  - weekly: прошлые 7 дней (понедельник — отчёт за предыдущую неделю)
  - monthly: предыдущий календарный месяц
- Запрашивает HTML-отчет у локального Flask-сервера (http://127.0.0.1:3002/client/<id>/report?date_from=...&date_to=...)
- Отправляет HTML письмом на указанные адреса (через localhost SMTP)

Настройки SMTP (опционально) через env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
"""
import os, sqlite3, datetime, requests, smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

CRM_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_data.db')
FLASK_URL = os.environ.get('FLASK_URL', 'http://127.0.0.1:3002')
SMTP_HOST = os.environ.get('SMTP_HOST', 'localhost')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '25'))
SMTP_USER = os.environ.get('SMTP_USER')
SMTP_PASS = os.environ.get('SMTP_PASS')
MAIL_FROM = os.environ.get('MAIL_FROM', 'no-reply@example.com')


def period_for_schedule(schedule):
    today = datetime.date.today()
    if schedule == 'daily':
        d_to = today - datetime.timedelta(days=1)
        d_from = d_to
    elif schedule == 'weekly':
        # last full week Monday-Sunday
        # find last week's Monday
        last_monday = today - datetime.timedelta(days=today.weekday() + 7)
        d_from = last_monday
        d_to = last_monday + datetime.timedelta(days=6)
    elif schedule == 'monthly':
        first_this_month = today.replace(day=1)
        last_month_end = first_this_month - datetime.timedelta(days=1)
        d_from = last_month_end.replace(day=1)
        d_to = last_month_end
    else:
        return None, None
    return d_from.strftime('%Y-%m-%d'), d_to.strftime('%Y-%m-%d')


def send_mail(to_addrs, subject, html_body):
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = MAIL_FROM
    msg['To'] = ', '.join(to_addrs)
    part = MIMEText(html_body, 'html')
    msg.attach(part)

    try:
        if SMTP_USER and SMTP_PASS:
            s = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(MAIL_FROM, to_addrs, msg.as_string())
            s.quit()
        else:
            s = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
            s.sendmail(MAIL_FROM, to_addrs, msg.as_string())
            s.quit()
        return True
    except Exception as e:
        print('Mail send failed:', e)
        return False


def main():
    if not os.path.exists(CRM_DB):
        print('crm_data.db not found')
        return
    conn = sqlite3.connect(CRM_DB)
    cur = conn.cursor()
    def process_client_row(cid, cname, emails, schedule):
        if not emails or (not schedule) or schedule == 'none':
            return
        d_from, d_to = period_for_schedule(schedule)
        if not d_from:
            return
        to_addrs = [e.strip() for e in emails.split(',') if e.strip()]
        if not to_addrs:
            return
        # fetch report HTML from local app
        try:
            url = f"{FLASK_URL}/client/{cid}/report?date_from={d_from}&date_to={d_to}"
            print('Fetching', url)
            r = requests.get(url, timeout=30)
            if r.status_code != 200:
                print(f'Failed to fetch report for client {cid}: HTTP {r.status_code}')
                return
            html = r.text
            subject = f'Отчет по ИТ-инфраструктуре {cname} за период {d_from} — {d_to}'
            ok = send_mail(to_addrs, subject, html)
            if ok:
                print(f'Sent report to {to_addrs} for client {cid}')
                # update last_report_sent
                try:
                    cur2 = conn.cursor()
                    cur2.execute("UPDATE clients SET last_report_sent = DATE('now') WHERE id = ?", (cid,))
                    conn.commit()
                except Exception:
                    pass
            else:
                print('Failed to send mail for client', cid)
        except Exception as e:
            print('Error preparing report for client', cid, e)

    cols = [c[1] for c in cur.execute("PRAGMA table_info(clients)").fetchall()]
    if 'report_frequency' in cols:
        cur.execute('SELECT id, company_name, email_reports, report_frequency FROM clients')
        rows = cur.fetchall()
        for cid, cname, emails, schedule in rows:
            process_client_row(cid, cname, emails, schedule)
    else:
        cur.execute('SELECT id, company_name, email_reports, report_schedule FROM clients')
        rows = cur.fetchall()
        for cid, cname, emails, schedule in rows:
            process_client_row(cid, cname, emails, schedule)

    conn.close()


if __name__ == '__main__':
    main()
