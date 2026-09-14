import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SABY_RPC_URL = 'https://online.sbis.ru/service/sbis-rpc.service';

export function getSabyCredentials() {
  let clientId = (process.env.SABY_APP_CLIENT_ID || '').trim();
  let appSecret = (process.env.SABY_APP_SECRET || '').trim();
  let secretKey = (process.env.SABY_SECRET_KEY || '').trim();

  // Also check .saby_config files
  const candidates = [
    path.join(__dirname, '.saby_config'),
    '/opt/backup-reports/.saby_config'
  ];

  for (const p of candidates) {
    if ((!clientId || !appSecret || !secretKey) && fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (!clientId && parsed.app_client_id) clientId = parsed.app_client_id;
        if (!appSecret && parsed.app_secret) appSecret = parsed.app_secret;
        if (!secretKey && parsed.secret_key) secretKey = parsed.secret_key;
      } catch (e) {
        // ignore parse error
      }
    }
  }

  return {
    clientId,
    appSecret,
    secretKey,
    hasCredentials: !!(clientId && appSecret && secretKey)
  };
}

let activeSabyToken = null;
let tokenExpiresAt = 0;

export async function authenticateSaby() {
  const creds = getSabyCredentials();
  if (!creds.clientId || !creds.appSecret) {
    return {
      ok: false,
      configured: false,
      message: 'Учетные данные Saby API не настроены (требуются ID подключения и Секрет приложения).'
    };
  }
  if (!creds.secretKey) {
    return {
      ok: false,
      configured: false,
      message: 'Сервисный ключ Saby не задан. Вставьте содержимое файла ключа (.key) в настройках.'
    };
  }

  // Cache token for 30 minutes
  if (activeSabyToken && Date.now() < tokenExpiresAt) {
    return { ok: true, token: activeSabyToken, cached: true };
  }

  const authParams = {
    app_client_id: creds.clientId,
    app_secret: creds.appSecret,
    secret_key: creds.secretKey
  };

  const endpoints = [
    'https://online.sbis.ru/oauth/service/',
    'https://online.saby.ru/oauth/service/',
    'https://api.saby.ru/oauth/service/'
  ];

  let lastError = null;

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json'
        },
        body: JSON.stringify(authParams),
        signal: AbortSignal.timeout(8000)
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        let parsedErr = '';
        try {
          const jsonErr = JSON.parse(errorText);
          parsedErr = jsonErr.error_message || jsonErr.error?.message || jsonErr.message || errorText;
        } catch (_) {
          parsedErr = errorText;
        }
        lastError = `HTTP ${res.status}: ${parsedErr || res.statusText}`;
        continue;
      }

      const json = await res.json();
      if (json.error) {
        const errMsg = json.error_message || json.error.message || (typeof json.error === 'string' ? json.error : JSON.stringify(json.error));
        return {
          ok: false,
          configured: true,
          message: `Ошибка Saby OAuth: ${errMsg}`
        };
      }

      const token = json.access_token || json.sid || json.token || json.result;
      if (!token) {
        return {
          ok: false,
          configured: true,
          message: `Saby не вернул access_token: ${JSON.stringify(json)}`
        };
      }

      activeSabyToken = token;
      tokenExpiresAt = Date.now() + 30 * 60 * 1000;

      return {
        ok: true,
        configured: true,
        token,
        message: 'Успешная авторизация в Saby API (токен доступа получен).'
      };
    } catch (err) {
      lastError = err.message;
    }
  }

  return {
    ok: false,
    configured: true,
    message: `Не удалось связаться с Saby API: ${lastError}`
  };
}

export async function testSabyConnection() {
  activeSabyToken = null;
  tokenExpiresAt = 0;
  const auth = await authenticateSaby();
  return auth;
}

export async function searchSabyCompany(inn) {
  const auth = await authenticateSaby();
  if (!auth.ok) {
    return { ok: false, error: auth.message, items: [] };
  }

  try {
    const payload = {
      jsonrpc: '2.0',
      method: 'СБИС.ИнформацияОКонтрагенте',
      params: {
        Реквизиты: {
          ИНН: inn
        }
      },
      id: 2
    };

    const res = await fetch(SABY_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json-rpc; charset=utf-8',
        'X-SBISAccessToken': auth.token || ''
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, items: [] };
    }

    const json = await res.json();
    if (json.error || !json.result) {
      return { ok: false, error: json.error?.message || 'Организация не найдена в Saby', items: [] };
    }

    return {
      ok: true,
      company: {
        name: json.result.Название || json.result.КраткоеНаименование,
        inn: json.result.ИНН || inn,
        kpp: json.result.КПП,
        ogrn: json.result.ОГРН,
        director: json.result.Руководитель,
        address: json.result.ЮридическийАдрес || json.result.Адрес
      }
    };
  } catch (err) {
    return { ok: false, error: err.message, items: [] };
  }
}

export async function fetchSabyContracts(inn) {
  const auth = await authenticateSaby();
  if (!auth.ok) {
    return { ok: false, error: auth.message, contracts: [] };
  }

  try {
    const payload = {
      jsonrpc: '2.0',
      method: 'СБИС.СписокДокументов',
      params: {
        Фильтр: {
          Регламент: 'Оказания услуг (Аутсорсинг) с кабинетом',
          КонтрагентИНН: inn
        }
      },
      id: 3
    };

    const res = await fetch(SABY_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json-rpc; charset=utf-8',
        'X-SBISAccessToken': auth.token || ''
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, contracts: [] };
    }

    const json = await res.json();
    if (json.error) {
      return { ok: false, error: json.error.message, contracts: [] };
    }

    const rawList = json.result?.Документы || json.result || [];
    const contracts = rawList.map((d, i) => ({
      id: d.Идентификатор || `saby-cnt-${i}`,
      number: d.Номер || `№ ${i + 1}`,
      title: d.Название || 'Договор технического сопровождения (Saby)',
      date: d.Дата || new Date().toISOString().slice(0, 10),
      plan_hours: d.Часы || 15,
      tariff: d.Сумма ? `${d.Сумма} ₽ / мес` : '40 000 ₽ / мес',
      status: d.Статус || 'Действует',
      sla: '99.5%'
    }));

    return { ok: true, contracts };
  } catch (err) {
    return { ok: false, error: err.message, contracts: [] };
  }
}

export async function fetchSabyRequests(inn) {
  const auth = await authenticateSaby();
  if (!auth.ok) return { ok: false, error: auth.message, requests: [] };

  try {
    const payload = {
      jsonrpc: '2.0',
      method: 'СБИС.СписокДокументов',
      params: {
        Фильтр: {
          Регламент: 'Обращение',
          КонтрагентИНН: inn
        }
      },
      id: 4
    };
    
    const res = await fetch(SABY_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json-rpc; charset=utf-8',
        'X-SBISAccessToken': auth.token || ''
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });
    
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, requests: [] };
    const json = await res.json();
    if (json.error) return { ok: false, error: json.error.message, requests: [] };
    
    const rawList = json.result?.Документы || json.result || [];
    const requests = rawList.map((d, i) => ({
      id: d.Идентификатор || `saby-req-${i}`,
      number: d.Номер || `№ ${i + 1}`,
      subject: d.Название || d.Тема || 'Обращение',
      date: d.Дата || new Date().toISOString().slice(0, 10),
      status: d.Статус || 'В работе',
      executor: d.Ответственный || 'Не назначен'
    }));
    
    return { ok: true, requests };
  } catch (err) {
    return { ok: false, error: err.message, requests: [] };
  }
}

export async function fetchSabyWorks(inn) {
  const auth = await authenticateSaby();
  if (!auth.ok) return { ok: false, error: auth.message, works: [] };

  try {
    const payload = {
      jsonrpc: '2.0',
      method: 'СБИС.СписокДокументов',
      params: {
        Фильтр: {
          Регламент: 'Акт выполненных работ',
          КонтрагентИНН: inn
        }
      },
      id: 5
    };
    
    const res = await fetch(SABY_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json-rpc; charset=utf-8',
        'X-SBISAccessToken': auth.token || ''
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });
    
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, works: [] };
    const json = await res.json();
    if (json.error) return { ok: false, error: json.error.message, works: [] };
    
    const rawList = json.result?.Документы || json.result || [];
    const works = rawList.map((d, i) => ({
      id: d.Идентификатор || `saby-work-${i}`,
      document_number: d.Номер || `№ ${i + 1}`,
      date: d.Дата || new Date().toISOString().slice(0, 10),
      work_name: d.Название || 'Услуги по договору',
      quantity: d.Количество || 1,
      unit: d.ЕдИзмерения || 'шт',
      price: d.Цена || (d.Сумма || 0),
      sum: d.Сумма || 0
    }));
    
    return { ok: true, works };
  } catch (err) {
    return { ok: false, error: err.message, works: [] };
  }
}
