import json
import requests
import os

CONFIG_PATH = "/opt/backup-reports/.saby_config"

def get_saby_token(logs):
    if not os.path.exists(CONFIG_PATH):
        logs.append(f"Ошибка: файл {CONFIG_PATH} не найден")
        return None
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        
        url = "https://online.sbis.ru/oauth/service/"
        payload = {
            "app_client_id": cfg.get("app_client_id"),
            "app_secret": cfg.get("app_secret"),
            "secret_key": cfg.get("secret_key")
        }
        resp = requests.post(url, json=payload, timeout=10)
        res = resp.json()
        token = res.get("token")
        if not token:
            logs.append(f"Ошибка получения токена: {resp.text}")
            return None
        logs.append("Токен доступа успешно получен")
        return token
    except Exception as e:
        logs.append(f"Исключение при авторизации: {str(e)}")
        return None

def get_saby_contract_data(inn):
    logs = []
    if not inn:
        logs.append("Ошибка: не указан ИНН")
        return [], "Не указан ИНН", logs

    logs.append(f"Поиск документов в Saby по ИНН: {inn}")
    token = get_saby_token(logs)
    if not token:
        return [], "Ошибка авторизации в Saby", logs

    try:
        api_url = "https://online.sbis.ru/service/sbis-rpc.service"
        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "X-SBISAccessToken": token
        }

        contractor_obj = {"СвЮЛ": {"ИНН": inn}} if len(inn) == 10 else {"СвФЛ": {"ИНН": inn}}
        found_docs = []

        # Запрос по регламенту аутсорсинга
        payload_reg = {
            "jsonrpc": "2.0",
            "method": "СБИС.СписокДокументов",
            "params": {
                "Фильтр": {
                    "Тип": "ДоговорИсх",
                    "Регламент": {
                        "Название": "Оказания услуг (Аутсорсинг) с кабинетом"
                    },
                    "Контрагент": contractor_obj,
                    "Навигация": {
                        "РазмерСтраницы": "50",
                        "Страница": "0"
                    }
                }
            },
            "id": 1
        }
        
        logs.append("Запрос по регламенту Saby...")
        r = requests.post(api_url, json=payload_reg, headers=headers, timeout=10)
        res = r.json()
        
        if "result" in res:
            docs = res["result"].get("Документ", [])
            if isinstance(docs, dict):
                docs = [docs]
            for d in docs:
                found_docs.append({
                    "id": d.get("Идентификатор", ""),
                    "number": d.get("Номер", "б/н"),
                    "title": d.get("Примечание", d.get("Название", "Договор аутсорсинга")),
                    "date": d.get("Дата", ""),
                    "sum": d.get("Сумма", "0")
                })

        if found_docs:
            logs.append(f"Найдено реальных документов: {len(found_docs)}")
            return found_docs, None, logs
        else:
            logs.append("Документов по регламенту не найдено.")
            return [], None, logs

    except Exception as e:
        logs.append(f"Исключение RPC: {str(e)}")
        return [], str(e), logs
