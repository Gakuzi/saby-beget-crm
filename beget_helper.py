import requests
import json
import urllib.parse

def api_call(method, login=None, passwd=None, api_key=None, input_data=None, timeout=10):
    """Generic wrapper to call Beget API methods.
    Supports old login/passwd style and optional api_key parameter if provided by user.
    Returns parsed JSON or raises.
    """
    base_url = "https://api.beget.com/api"
    params = []
    auth_part = ''
    if api_key:
        # some setups may accept api_key as 'api_key' parameter — try it
        params.append(f"api_key={api_key}")
    else:
        if login is not None and passwd is not None:
            params.append(f"login={login}")
            params.append(f"passwd={passwd}")
    params.append('input_format=json')
    params.append('output_format=json')
    if input_data is not None:
        # encode JSON input_data into input_data param
        params.append('input_data=' + urllib.parse.quote(json.dumps(input_data)))
    url = f"{base_url}/{method}?" + '&'.join(params)
    resp = requests.get(url, timeout=timeout)
    return resp.json()


def get_full_beget_report(login, passwd, api_key=None):
    """Сбор максимально детального отчета с хостинга Beget для ежемесячного акта
    Поддерживает авторизацию через login+passwd либо api_key (если передан).
    """
    report_data = {
        "mailboxes": [],
        "domains": [],
        "sites": [],
        "databases": [],
        "account": {},
        "error": None
    }
    
    if not ((login and passwd) or api_key):
        report_data["error"] = "Не заданы учетные данные Beget API"
        return report_data

    try:
        # 1. Информация об аккаунте и балансе
        try:
            acc_resp = api_call('user/getAccountInfo', login=login, passwd=passwd, api_key=api_key)
            if acc_resp.get("status") == "success":
                report_data["account"] = acc_resp.get("answer", {}).get("result", {})
        except Exception as e:
            # non-fatal
            report_data["account"] = {}

        # 2. Домены
        try:
            dom_resp = api_call('domain/getList', login=login, passwd=passwd, api_key=api_key)
            domains_list = []
            if dom_resp.get("status") == "success":
                domains_list = dom_resp.get("answer", {}).get("result", [])
            report_data["domains"] = domains_list
        except Exception:
            report_data["domains"] = []

        # 3. Сайты
        try:
            site_resp = api_call('site/getList', login=login, passwd=passwd, api_key=api_key)
            if site_resp.get("status") == "success":
                report_data["sites"] = site_resp.get("answer", {}).get("result", [])
            else:
                report_data["sites"] = []
        except Exception:
            report_data["sites"] = []

        # 4. Базы данных
        try:
            db_resp = api_call('mysql/getList', login=login, passwd=passwd, api_key=api_key)
            if db_resp.get("status") == "success":
                report_data["databases"] = db_resp.get("answer", {}).get("result", [])
            else:
                report_data["databases"] = []
        except Exception:
            report_data["databases"] = []

        # 5. Почтовые ящики по каждому домену
        all_mailboxes = []
        for d in report_data.get('domains', []):
            fqdn = d.get("fqdn")
            if not fqdn or "beget.tech" in fqdn:
                continue
            try:
                payload = {"domain": fqdn}
                m_resp = api_call('mail/getMailboxList', login=login, passwd=passwd, api_key=api_key, input_data=payload)
                if m_resp.get("status") == "success":
                    boxes = m_resp.get("answer", {}).get("result", [])
                    if isinstance(boxes, list):
                        for b in boxes:
                            b["domain_fqdn"] = fqdn
                            all_mailboxes.append(b)
                    elif isinstance(boxes, dict):
                        for b_name, b_info in boxes.items():
                            if isinstance(b_info, dict):
                                b_info["mailbox"] = b_name
                                b_info["domain_fqdn"] = fqdn
                                all_mailboxes.append(b_info)
                            else:
                                all_mailboxes.append({"mailbox": b_name, "domain_fqdn": fqdn})
            except Exception:
                continue

        report_data["mailboxes"] = all_mailboxes

    except Exception as e:
        report_data["error"] = f"Ошибка запроса к Beget API: {str(e)}"

    return report_data


def get_events(login, passwd, start_ts=None, end_ts=None):
    """Попытка собрать события с Beget: возвращаем список событий в виде dict
    Поскольку API Beget для логов может различаться, здесь делаем несколько попыток
    и собираем то, что доступно: домены, сайты, почтовые ящики, БД — как события текущего состояния.
    """
    events = []
    if not login or not passwd:
        return events
    try:
        base_url = "https://api.beget.com/api"
        # domains
        dom_resp = requests.get(f"{base_url}/domain/getList?login={login}&passwd={passwd}&input_format=json&output_format=json", timeout=10).json()
        if dom_resp.get('status') == 'success':
            for d in dom_resp.get('answer', {}).get('result', []):
                fqdn = d.get('fqdn') or d.get('domain') or None
                events.append({
                    'event_type': 'domain_presence',
                    'details': d,
                    'event_time': None,
                    'source': 'beget_domain_getList',
                    'method': 'domain/getList',
                    'confidence': 'presence_only'  # присутствие домена в списке, не действие
                })
        # sites
        site_resp = requests.get(f"{base_url}/site/getList?login={login}&passwd={passwd}&input_format=json&output_format=json", timeout=10).json()
        if site_resp.get('status') == 'success':
            for s in site_resp.get('answer', {}).get('result', []):
                events.append({
                    'event_type': 'site_presence',
                    'details': s,
                    'event_time': None,
                    'source': 'beget_site_getList',
                    'method': 'site/getList',
                    'confidence': 'presence_only'  # присутствие сайта в списке — не прямое действие
                })
        # databases
        db_resp = requests.get(f"{base_url}/mysql/getList?login={login}&passwd={passwd}&input_format=json&output_format=json", timeout=10).json()
        if db_resp.get('status') == 'success':
            for db in db_resp.get('answer', {}).get('result', []):
                events.append({
                    'event_type': 'db_presence',
                    'details': db,
                    'event_time': None,
                    'source': 'beget_mysql_getList',
                    'method': 'mysql/getList',
                    'confidence': 'presence_only'  # присутствие БД в списке — не прямое действие
                })
        # mailboxes per domain
        doms = []
        if dom_resp.get('status') == 'success':
            doms = dom_resp.get('answer', {}).get('result', [])
        for d in doms:
            fqdn = d.get('fqdn')
            if not fqdn:
                continue
            payload = {"domain": fqdn}
            encoded_input = urllib.parse.quote(json.dumps(payload))
            mail_url = f"{base_url}/mail/getMailboxList?login={login}&passwd={passwd}&input_format=json&output_format=json&input_data={encoded_input}"
            try:
                m_resp = requests.get(mail_url, timeout=8).json()
                if m_resp.get('status') == 'success':
                    boxes = m_resp.get('answer', {}).get('result', [])
                    if isinstance(boxes, list):
                        for b in boxes:
                            events.append({
                                'event_type': 'mailbox_presence',
                                'details': {'domain': fqdn, 'mailbox': b},
                                'event_time': None,
                                'source': 'beget_mail_getMailboxList',
                                'method': 'mail/getMailboxList',
                                'confidence': 'presence_only'  # присутствие почтового ящика в списке
                            })
                    elif isinstance(boxes, dict):
                        for b_name, b_info in boxes.items():
                            events.append({
                                'event_type': 'mailbox_presence',
                                'details': {'domain': fqdn, 'mailbox': b_name, 'info': b_info},
                                'event_time': None,
                                'source': 'beget_mail_getMailboxList',
                                'method': 'mail/getMailboxList',
                                'confidence': 'presence_only'  # присутствие почтового ящика в списке
                            })
            except Exception:
                continue
    except Exception:
        pass
    return events


def parse_balance_from_account(account_obj):
    """Попытка извлечь числовой баланс и валюту из структуры account в ответе Beget.
    Возвращает dict: {'balance': float or None, 'currency': str or None, 'raw': account_obj}
    """
    result = {'balance': None, 'currency': None, 'raw': account_obj}
    if not account_obj or not isinstance(account_obj, dict):
        return result
    # common keys that may contain balance
    candidates = ['balance', 'money', 'amount', 'sum']
    for k in candidates:
        if k in account_obj:
            try:
                val = account_obj.get(k)
                if isinstance(val, (int, float)):
                    result['balance'] = float(val)
                elif isinstance(val, str):
                    vv = ''.join(ch for ch in val if (ch.isdigit() or ch in '.-,'))
                    vv = vv.replace(',', '.')
                    result['balance'] = float(vv)
                if 'currency' in account_obj:
                    result['currency'] = account_obj.get('currency')
                break
            except Exception:
                continue
    # fallback: scan values for numeric
    if result['balance'] is None:
        for k, v in account_obj.items():
            if isinstance(v, (int, float)):
                result['balance'] = float(v)
                break
            if isinstance(v, str):
                try:
                    vv = v.replace(',', '.')
                    if any(ch.isdigit() for ch in vv):
                        cleaned = ''.join(ch for ch in vv if (ch.isdigit() or ch in '.-,'))
                        cleaned = cleaned.replace(',', '.')
                        result['balance'] = float(cleaned)
                        break
                except Exception:
                    continue
    return result


def get_invoices(login, passwd, api_key=None, params=None):
    """Попытка получить список счетов через API (если доступно)."""
    try:
        resp = api_call('invoice/getList', login=login, passwd=passwd, api_key=api_key, input_data=params)
        if resp.get('status') == 'success':
            return resp.get('answer', {}).get('result', [])
    except Exception:
        pass
    return []


def get_billing_history(login, passwd, api_key=None, params=None):
    """Попытка получить историю биллинга/платежей. Пробуем несколько методов, возвращаем первый успешный."""
    candidates = ['billing/getList', 'billing/getHistory', 'invoice/getPayments']
    for m in candidates:
        try:
            resp = api_call(m, login=login, passwd=passwd, api_key=api_key, input_data=params)
            if resp.get('status') == 'success':
                return resp.get('answer', {}).get('result', [])
        except Exception:
            continue
    return []


def get_account_balance(login, passwd, api_key=None):
    """Удобная обертка: получает account info и парсит баланс."""
    try:
        rep = get_full_beget_report(login, passwd, api_key=api_key)
        acc = rep.get('account') or {}
        return parse_balance_from_account(acc)
    except Exception:
        return {'balance': None, 'currency': None, 'raw': None}

