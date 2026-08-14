import requests
import json
import urllib.parse

def get_full_beget_report(login, passwd):
    """Сбор максимально детального отчета с хостинга Beget для ежемесячного акта"""
    report_data = {
        "mailboxes": [],
        "domains": [],
        "sites": [],
        "databases": [],
        "account": {},
        "error": None
    }
    
    if not login or not passwd:
        report_data["error"] = "Не заданы учетные данные Beget API"
        return report_data

    base_url = "https://api.beget.com/api"

    try:
        # 1. Информация об аккаунте и балансе
        acc_resp = requests.get(f"{base_url}/user/getAccountInfo?login={login}&passwd={passwd}&input_format=json&output_format=json", timeout=10).json()
        if acc_resp.get("status") == "success":
            report_data["account"] = acc_resp.get("answer", {}).get("result", {})

        # 2. Домены
        dom_resp = requests.get(f"{base_url}/domain/getList?login={login}&passwd={passwd}&input_format=json&output_format=json", timeout=10).json()
        domains_list = []
        if dom_resp.get("status") == "success":
            domains_list = dom_resp.get("answer", {}).get("result", [])
            report_data["domains"] = domains_list

        # 3. Сайты
        site_resp = requests.get(f"{base_url}/site/getList?login={login}&passwd={passwd}&input_format=json&output_format=json", timeout=10).json()
        if site_resp.get("status") == "success":
            report_data["sites"] = site_resp.get("answer", {}).get("result", [])

        # 4. Базы данных
        db_resp = requests.get(f"{base_url}/mysql/getList?login={login}&passwd={passwd}&input_format=json&output_format=json", timeout=10).json()
        if db_resp.get("status") == "success":
            report_data["databases"] = db_resp.get("answer", {}).get("result", [])

        # 5. Почтовые ящики по каждому домену
        all_mailboxes = []
        for d in domains_list:
            fqdn = d.get("fqdn")
            if not fqdn or "beget.tech" in fqdn:
                continue
            
            payload = {"domain": fqdn}
            encoded_input = urllib.parse.quote(json.dumps(payload))
            mail_url = f"{base_url}/mail/getMailboxList?login={login}&passwd={passwd}&input_format=json&output_format=json&input_data={encoded_input}"
            m_resp = requests.get(mail_url, timeout=8).json()
            
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

        report_data["mailboxes"] = all_mailboxes

    except Exception as e:
        report_data["error"] = f"Ошибка запроса к Beget API: {str(e)}"

    return report_data
