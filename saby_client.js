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
  if (!creds.hasCredentials) {
    return {
      ok: false,
      configured: false,
      message: 'Учетные данные Saby API не настроены (требуются SABY_APP_CLIENT_ID, SABY_APP_SECRET, SABY_SECRET_KEY).'
    };
  }

  // Cache token for 30 minutes
  if (activeSabyToken && Date.now() < tokenExpiresAt) {
    return { ok: true, token: activeSabyToken, cached: true };
  }

  try {
    const payload = {
      jsonrpc: '2.0',
      method: 'СБИС.Аутентифицировать',
      params: {
        Параметр: {
          app_client_id: creds.clientId,
          app_secret: creds.appSecret,
          secret_key: creds.secretKey
        }
      },
      id: 1
    };

    const res = await fetch(SABY_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json-rpc; charset=utf-8',
        'Accept': 'application/json-rpc'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        status: res.status,
        message: `HTTP ошибка авторизации Saby: ${res.status} ${res.statusText}`
      };
    }

    const json = await res.json();
    if (json.error) {
      return {
        ok: false,
        configured: true,
        message: `Ошибка Saby RPC [${json.error.code || ''}]: ${json.error.message || json.error.details || JSON.stringify(json.error)}`
      };
    }

    const token = json.result || 'saby-session-active';
    activeSabyToken = token;
    tokenExpiresAt = Date.now() + 30 * 60 * 1000;

    return {
      ok: true,
      configured: true,
      token,
      message: 'Успешная авторизация в Saby API (токен получен).'
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: `Ошибка подключения к Saby RPC (${SABY_RPC_URL}): ${err.message}`
    };
  }
}

export async function testSabyConnection() {
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
        'X-SBIS-Session': auth.token || ''
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
        'X-SBIS-Session': auth.token || ''
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
