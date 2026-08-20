import requests

def check_inn_checksum(inn: str) -> bool:
    inn = str(inn).strip()
    if not inn.isdigit():
        return False
    if len(inn) == 10:
        coeffs = [2, 4, 10, 3, 5, 9, 4, 6, 8]
        s = sum(int(d) * c for d, c in zip(inn[:9], coeffs))
        return (s % 11 % 10) == int(inn[9])
    elif len(inn) == 12:
        coeffs_11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8, 0]
        coeffs_12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8, 0]
        s1 = sum(int(d) * c for d, c in zip(inn[:11], coeffs_11))
        d11 = s1 % 11 % 10
        s2 = sum(int(d) * c for d, c in zip(inn[:12], coeffs_12))
        d12 = s2 % 11 % 10
        return (d11 == int(inn[10])) and (d12 == int(inn[11]))
    return False

def suggest_company(query: str):
    query = query.strip()
    if not query or len(query) < 2:
        return []

    results = []

    # 1. Если ИНН валиден, сразу возвращаем подсказку (Rusprofile заблокирован)
    if query.isdigit():
        is_valid = check_inn_checksum(query)
        if is_valid:
            # Пытаемся получить название из Saby
            try:
                from saby_helper import get_saby_token
                logs = []
                token = get_saby_token(logs)
                if token:
                    api_url = "https://online.sbis.ru/service/sbis-rpc.service"
                    headers = {
                        "Content-Type": "application/json; charset=utf-8",
                        "X-SBISAccessToken": token
                    }
                    contractor_obj = {"СвЮЛ": {"ИНН": query}} if len(query) == 10 else {"СвФЛ": {"ИНН": query}}
                    payload = {
                        "jsonrpc": "2.0",
                        "method": "СБИС.Контрагенты.ПолучитьИнформациюОКонтрагенте",
                        "params": {"Контрагент": contractor_obj},
                        "id": 1
                    }
                    r = requests.post(api_url, json=payload, headers=headers, timeout=5)
                    res = r.json()
                    if "result" in res:
                        company_info = res["result"]
                        name = company_info.get("НаименованиеПолное") or company_info.get("НаименованиеСокращенное") or company_info.get("ФИОПолное")
                        if name:
                            results.append({
                                "name": name,
                                "inn": query,
                                "address": company_info.get("Адрес", "")
                            })
            except Exception:
                pass
            
            # Если не получили из Saby, возвращаем заглушку
            if not results:
                results.append({
                    "name": "Организация (ИНН валиден)",
                    "inn": query,
                    "address": "Контрольная сумма верна"
                })
        return results

    # 2. Поиск по названию через Saby (если не ИНН)
    if not query.isdigit():
        try:
            from saby_helper import get_saby_token
            logs = []
            token = get_saby_token(logs)
            if token:
                api_url = "https://online.sbis.ru/service/sbis-rpc.service"
                headers = {
                    "Content-Type": "application/json; charset=utf-8",
                    "X-SBISAccessToken": token
                }
                payload = {
                    "jsonrpc": "2.0",
                    "method": "СБИС.Контрагенты.НайтиКонтрагентов",
                    "params": {"Поиск": query, "РазмерСтраницы": 6},
                    "id": 1
                }
                r = requests.post(api_url, json=payload, headers=headers, timeout=5)
                res = r.json()
                if "result" in res:
                    companies = res["result"].get("Контрагенты", [])
                    for comp in companies[:6]:
                        name = comp.get("НаименованиеПолное") or comp.get("НаименованиеСокращенное") or comp.get("ФИОПолное")
                        inn = comp.get("ИНН", "")
                        if name and inn:
                            results.append({
                                "name": name,
                                "inn": inn,
                                "address": comp.get("Адрес", "")
                            })
        except Exception:
            pass

    return results
