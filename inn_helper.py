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

    # 1. Поиск через открытый сервис Rusprofile / API ФНС (Egrip/Egrul)
    try:
        url = f"https://www.rusprofile.ru/ajax.php?query={requests.utils.quote(query)}&action=search"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json"
        }
        r = requests.get(url, headers=headers, timeout=3)
        if r.status_code == 200:
            data = r.json()
            items = data.get("ul", []) + data.get("ip", [])
            for item in items[:6]:
                name = item.get("name", "") or item.get("raw_name", "")
                inn = item.get("inn", "")
                address = item.get("address", "")
                if name and inn:
                    results.append({
                        "name": name,
                        "inn": inn,
                        "address": address
                    })
    except Exception:
        pass

    # 2. Если сервис недоступен, проверяем ИНН на валидность и возвращаем локальную подсказку
    if not results and query.isdigit():
        is_valid = check_inn_checksum(query)
        if is_valid:
            results.append({
                "name": "Организация (ИНН валиден)",
                "inn": query,
                "address": "Контрольная сумма верна"
            })

    return results
