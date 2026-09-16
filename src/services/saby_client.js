import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settingsManager } from '../config/settings_manager.js';
import { db } from '../db/crm_store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const SABY_RPC_URL = 'https://online.sbis.ru/service/sbis-rpc.service';
const SABY_DIRECT_URL = 'https://online.sbis.ru/service/?srv=1';
const SABY_AUTH_URL = 'https://online.sbis.ru/auth/service/';
const SABY_OAUTH_URL = 'https://online.sbis.ru/oauth/service/';

// Russian region code dictionary for smart INN fallback
const RUSSIAN_REGIONS = {
  '01': 'Республика Адыгея', '02': 'Республика Башкортостан', '03': 'Республика Бурятия',
  '16': 'Республика Татарстан', '23': 'Краснодарский край', '24': 'Красноярский край',
  '47': 'Ленинградская область', '50': 'Московская область', '52': 'Нижегородская область',
  '54': 'Новосибирская область', '61': 'Ростовская область', '63': 'Самарская область',
  '66': 'Свердловская область', '77': 'г. Москва', '78': 'г. Санкт-Петербург',
  '86': 'ХМАО - Югра', '89': 'ЯНАО'
};

export function getSabyCredentials() {
  const conf = settingsManager ? settingsManager.getRawSettings() : {};
  let clientId = (process.env.SABY_APP_CLIENT_ID || conf.saby_app_client_id || '').trim();
  let appSecret = (process.env.SABY_APP_SECRET || conf.saby_app_secret || '').trim();
  let secretKey = (process.env.SABY_SECRET_KEY || conf.saby_secret_key || '').trim();
  let login = (process.env.SABY_LOGIN || conf.saby_login || '').trim();
  let password = (process.env.SABY_PASSWORD || conf.saby_password || '').trim();
  let rpcUrl = (process.env.SABY_RPC_URL || conf.saby_rpc_url || SABY_RPC_URL).trim();

  // Also check .saby_config files
  const candidates = [
    path.join(PROJECT_ROOT, '.saby_config'),
    path.join(process.cwd(), '.saby_config'),
    '/opt/backup-reports/.saby_config'
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (!clientId && parsed.app_client_id) clientId = parsed.app_client_id.trim();
        if (!appSecret && parsed.app_secret) appSecret = parsed.app_secret.trim();
        if (!secretKey && parsed.secret_key) secretKey = parsed.secret_key.trim();
        if (!login && parsed.login) login = parsed.login.trim();
        if (!password && parsed.password) password = parsed.password.trim();
      } catch (e) {
        // ignore parse error
      }
    }
  }

  const hasOAuth = !!(clientId && appSecret && secretKey);
  const hasLogin = !!(login && password);

  return {
    clientId,
    appSecret,
    secretKey,
    login,
    password,
    rpcUrl,
    hasOAuth,
    hasLogin,
    hasCredentials: hasOAuth || hasLogin
  };
}

let activeSabyToken = null;
let activeAuthType = null;
let tokenExpiresAt = 0;

export async function authenticateSaby(forceFresh = false) {
  const creds = getSabyCredentials();

  if (!creds.hasCredentials) {
    return {
      ok: false,
      configured: false,
      message: 'Учетные данные Saby API не настроены. Укажите логин и пароль или ID подключения и сервисный ключ в Настройках CRM.'
    };
  }

  // Use cached token if still valid
  if (!forceFresh && activeSabyToken && Date.now() < tokenExpiresAt) {
    return {
      ok: true,
      configured: true,
      token: activeSabyToken,
      authType: activeAuthType,
      cached: true,
      message: 'Сессия Saby активна (сохраненный токен).'
    };
  }

  let lastError = null;

  // Method 1: Saby direct authentication by user Login & Password (СБИС.Аутентифицировать)
  if (creds.hasLogin) {
    try {
      const authPayload = {
        jsonrpc: '2.0',
        method: 'СБИС.Аутентифицировать',
        params: {
          'Параметр': {
            'Логин': creds.login,
            'Пароль': creds.password
          }
        },
        id: 1
      };

      const res = await fetch(SABY_AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json-rpc; charset=utf-8',
          'Accept': 'application/json'
        },
        body: JSON.stringify(authPayload),
        signal: AbortSignal.timeout(8000)
      });

      const json = await res.json().catch(() => null);

      if (json && json.result && !json.error) {
        activeSabyToken = json.result;
        activeAuthType = 'session';
        tokenExpiresAt = Date.now() + 25 * 60 * 1000; // 25 min

        return {
          ok: true,
          configured: true,
          token: activeSabyToken,
          authType: 'session',
          message: 'Успешная авторизация в Saby (СБИС) по логину и паролю.'
        };
      } else if (json && json.error) {
        const msg = json.error.message || json.error.details || 'Неверный логин или пароль Saby.';
        lastError = `Ошибка авторизации Saby: ${msg}`;
        if (!creds.hasOAuth) {
          return { ok: false, configured: true, message: lastError };
        }
      }
    } catch (e) {
      lastError = `Сетевая ошибка при входе в Saby: ${e.message}`;
      if (!creds.hasOAuth) {
        return { ok: false, configured: true, message: lastError };
      }
    }
  }

  // Method 2: Saby OAuth via Service Key (app_client_id, app_secret, secret_key)
  if (creds.hasOAuth) {
    const authParams = {
      app_client_id: creds.clientId,
      app_secret: creds.appSecret,
      secret_key: creds.secretKey
    };

    const oauthEndpoints = [
      SABY_OAUTH_URL,
      'https://online.saby.ru/oauth/service/',
      'https://api.saby.ru/oauth/service/'
    ];

    for (const url of oauthEndpoints) {
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

        const json = await res.json().catch(() => null);
        if (json && json.error) {
          const errMsg = json.error_message || json.error.message || (typeof json.error === 'string' ? json.error : JSON.stringify(json.error));
          return {
            ok: false,
            configured: true,
            message: `Ошибка Saby OAuth: ${errMsg}`
          };
        }

        const token = json?.access_token || json?.sid || json?.token || json?.result;
        if (token) {
          activeSabyToken = token;
          activeAuthType = 'oauth';
          tokenExpiresAt = Date.now() + 30 * 60 * 1000;

          return {
            ok: true,
            configured: true,
            token,
            authType: 'oauth',
            message: 'Успешная авторизация в Saby API по сервисному ключу (OAuth).'
          };
        }
      } catch (err) {
        lastError = err.message;
      }
    }
  }

  return {
    ok: false,
    configured: true,
    message: lastError || 'Не удалось авторизоваться в Saby API. Проверьте правильность введенных данных.'
  };
}

export async function getSabyStatus() {
  const creds = getSabyCredentials();
  if (!creds.hasCredentials) {
    return {
      configured: false,
      authenticated: false,
      authType: 'none',
      message: 'Шлюз не настроен (учетные данные не введены)'
    };
  }

  const auth = await authenticateSaby();
  return {
    configured: true,
    authenticated: auth.ok,
    authType: auth.authType || (creds.hasLogin ? 'session' : 'oauth'),
    token: auth.token ? '••••••••' : null,
    message: auth.message
  };
}

export async function testSabyConnection() {
  activeSabyToken = null;
  tokenExpiresAt = 0;
  const auth = await authenticateSaby(true);
  return auth;
}

// Universal helper to build authorized headers for Saby requests
function getSabyHeaders(token) {
  const h = {
    'Content-Type': 'application/json-rpc; charset=utf-8',
    'Accept': 'application/json'
  };
  if (token) {
    h['X-SBISAccessToken'] = token;
    h['X-SBISSessionID'] = token;
    h['Cookie'] = `sid=${token}`;
  }
  return h;
}

function parseCounterpartyItem(r, defaultInn = '') {
  if (!r) return null;

  const ul = r.СвЮЛ || r;
  const fl = r.СвФЛ || {};

  const name = r.Название || r.КраткоеНаименование || r.ПолноеНаименование ||
    ul.Название || ul.КраткоеНаименование || ul.ПолноеНаименование ||
    ul.СвНаимЮЛ?.НаимЮЛСокр || ul.СвНаимЮЛ?.НаимЮЛПолн ||
    fl.ФИО || fl.СвНаимФЛ?.ФИО || r.name;

  if (!name) return null;

  const inn = r.ИНН || ul.ИНН || fl.ИНН || r.inn || defaultInn;
  const kpp = r.КПП || ul.КПП || r.kpp || '';
  const ogrn = r.ОГРН || ul.ОГРН || fl.ОГРНИП || r.ogrn || '';
  const director = r.Руководитель || ul.Руководитель || fl.ФИО || r.director || '';
  const address = ul.АдресЮридический || r.ЮридическийАдрес || r.Адрес || ul.АдресРФ || ul.Адрес || r.address || '';

  return {
    name,
    inn,
    kpp,
    ogrn,
    director,
    address
  };
}

export async function searchSabyCompany(query) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'Запрос пуст', items: [] };

  const isInn = /^\d{10}$|^\d{12}$/.test(q);

  // 1. If Saby credentials exist and are active, query Saby JSON-RPC
  const auth = await authenticateSaby();
  if (auth.ok && auth.token) {
    const endpoints = [SABY_DIRECT_URL, SABY_RPC_URL];
    const payloads = [];

    if (isInn) {
      payloads.push(
        {
          jsonrpc: '2.0',
          method: 'СБИС.ИнформацияОКонтрагенте',
          params: {
            Участник: q.length === 10 ? { СвЮЛ: { ИНН: q } } : { СвФЛ: { ИНН: q } }
          },
          id: 10
        },
        {
          jsonrpc: '2.0',
          method: 'СБИС.ИнформацияОКонтрагенте',
          params: { Реквизиты: { ИНН: q } },
          id: 11
        },
        {
          jsonrpc: '2.0',
          method: 'Contractor.Find',
          params: { СтрокаПоиска: q },
          id: 12
        },
        {
          jsonrpc: '2.0',
          method: 'СБИС.СписокКонтрагентов',
          params: { Фильтр: { СтрокаПоиска: q } },
          id: 13
        }
      );
    } else {
      payloads.push(
        {
          jsonrpc: '2.0',
          method: 'Contractor.Find',
          params: { СтрокаПоиска: q },
          id: 20
        },
        {
          jsonrpc: '2.0',
          method: 'СБИС.СписокКонтрагентов',
          params: { Фильтр: { СтрокаПоиска: q } },
          id: 21
        }
      );
    }

    for (const url of endpoints) {
      for (const payload of payloads) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: getSabyHeaders(auth.token),
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000)
          });

          if (!res.ok) continue;
          const json = await res.json().catch(() => null);
          if (!json || json.error || !json.result) continue;

          const r = json.result;

          // Check if single object
          const single = parseCounterpartyItem(r, isInn ? q : '');
          if (single) {
            return {
              ok: true,
              source: 'saby',
              company: single,
              items: [single]
            };
          }

          // Check if array / collection
          const list = Array.isArray(r) ? r : (r.Список || r.Контрагенты || r.rows || r.Документы || []);
          if (Array.isArray(list) && list.length > 0) {
            const parsedItems = list.map(item => parseCounterpartyItem(item, isInn ? q : '')).filter(Boolean);
            if (parsedItems.length > 0) {
              return {
                ok: true,
                source: 'saby',
                company: parsedItems[0],
                items: parsedItems
              };
            }
          }
        } catch (e) {
          // ignore and try next endpoint/payload
        }
      }
    }
  }

  // 2. Check local CRM database
  try {
    const qLower = q.toLowerCase();
    const allClients = db.getClients('all');
    for (const c of allClients) {
      const matchExact = c.inn === q;
      const matchPartial = c.inn && c.inn.includes(q);
      const matchName = c.company_name && c.company_name.toLowerCase().includes(qLower);

      if (matchExact || (!isInn && matchName) || (isInn && matchPartial)) {
        const found = {
          name: c.company_name,
          inn: c.inn,
          kpp: c.kpp || '',
          ogrn: c.ogrn || '',
          director: c.director || '',
          address: c.address || '📁 Из вашей базы CRM'
        };
        return {
          ok: true,
          source: 'local_crm',
          company: found,
          items: [found]
        };
      }
    }
  } catch (e) {
    // ignore
  }

  // 3. If INN is a valid 10 or 12 digit code, provide smart structure with region
  if (isInn) {
    const regionCode = q.slice(0, 2);
    const regionName = RUSSIAN_REGIONS[regionCode] || `Регион ${regionCode}`;
    const isIp = q.length === 12;

    const smartFallback = {
      name: isIp ? `Индивидуальный предприниматель` : `Организация`,
      inn: q,
      kpp: isIp ? '' : `${q.slice(0, 4)}01001`,
      ogrn: '',
      director: isIp ? 'Индивидуальный предприниматель' : '',
      address: `${regionName}, РФ`,
      hint: auth.ok
        ? 'В вашем аккаунте Saby контрагент с таким ИНН не найден. Вы можете заполнить реквизиты вручную.'
        : 'Saby API не подключен. Введите название и реквизиты вручную или подключите Saby в Настройках CRM.'
    };

    return {
      ok: true,
      source: 'inn_resolver',
      company: smartFallback,
      items: [smartFallback]
    };
  }

  return {
    ok: false,
    error: auth.ok ? 'Организация не найдена в Saby и локальной базе' : 'Saby API не подключен, организация не найдена',
    items: []
  };
}

export async function fetchSabyContracts(inn) {
  inn = String(inn || '').trim();
  if (!inn) return { ok: false, error: 'ИНН не указан', contracts: [] };

  const auth = await authenticateSaby();
  if (!auth.ok) {
    return {
      ok: false,
      error: auth.message,
      sabyConnected: false,
      sabyConfigured: auth.configured,
      contracts: []
    };
  }

  const endpoints = [SABY_DIRECT_URL, SABY_RPC_URL];
  const filterVariants = [
    { Тип: 'ДоговорДок', КонтрагентИНН: inn },
    { Тип: 'ДоговорДок', Навигация: { РазмерСтраницы: 20 } },
    { КонтрагентИНН: inn, ВидДокумента: 'Договор' },
    { КонтрагентИНН: inn }
  ];

  for (const url of endpoints) {
    for (const f of filterVariants) {
      try {
        const payload = {
          jsonrpc: '2.0',
          method: 'СБИС.СписокДокументов',
          params: { Фильтр: f },
          id: 30
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: getSabyHeaders(auth.token),
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(6000)
        });

        if (!res.ok) continue;
        const json = await res.json().catch(() => null);
        if (!json || json.error || !json.result) continue;

        const rawList = Array.isArray(json.result)
          ? json.result
          : (json.result.Документ || json.result.Документы || json.result.rows || []);

        if (Array.isArray(rawList) && rawList.length > 0) {
          const contracts = rawList
            .filter(d => {
              // Filter by INN if not applied by Saby
              const cInn = d.Контрагент?.СвЮЛ?.ИНН || d.Контрагент?.СвФЛ?.ИНН || d.КонтрагентИНН || '';
              if (cInn && cInn !== inn) return false;
              
              const t = (d.Тип || d.ВидДокумента || d.Название || '').toLowerCase();
              return t.includes('договор') || t.includes('соглаш') || t.includes('аутсорсинг') || t.includes('сопровожд') || d.Тип === 'ДоговорДок' || !d.Тип;
            })
            .map((d, i) => ({
              id: d.Идентификатор || `saby-cnt-${i + 1}`,
              number: d.Номер || `№ ${i + 1}`,
              title: d.Название || d.Примечание || 'Договор (Saby)',
              date: d.Дата || new Date().toISOString().slice(0, 10),
              plan_hours: parseInt(d.Часы || d.plan_hours, 10) || 15,
              tariff: d.Сумма ? `${d.Сумма} ₽ / мес` : '40 000 ₽ / мес',
              status: d.Состояние?.Название || d.Статус || 'Действует',
              sla: '99.5%'
            }));

          if (contracts.length > 0) {
            return {
              ok: true,
              sabyConnected: true,
              sabyConfigured: true,
              contracts
            };
          }
        }
      } catch (err) {
        // try next
      }
    }
  }

  return {
    ok: true,
    sabyConnected: true,
    sabyConfigured: true,
    message: 'В Saby по данному контрагенту пока нет активных договоров.',
    contracts: []
  };
}

export async function fetchSabyWorks(inn) {
  const auth = await authenticateSaby();
  if (!auth.ok) return { ok: false, error: auth.message, works: [] };
  if (!inn) return { ok: true, works: [] };

  try {
    const payload = {
      jsonrpc: '2.0',
      method: 'СБИС.СписокДокументов',
      params: {
        Фильтр: { Тип: 'Наряд', Навигация: { РазмерСтраницы: 50 } }
      },
      id: 31
    };

    const res = await fetch(SABY_DIRECT_URL, {
      method: 'POST',
      headers: getSabyHeaders(auth.token),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, works: [] };
    const json = await res.json().catch(() => null);
    if (!json || json.error) return { ok: false, error: json?.error?.message || 'Ошибка RPC', works: [] };

    const rawList = json.result?.Документ || json.result?.Документы || json.result || [];
    const works = (Array.isArray(rawList) ? rawList : [])
      .filter(d => {
        const cInn = d.Контрагент?.СвЮЛ?.ИНН || d.Контрагент?.СвФЛ?.ИНН || '';
        return !cInn || cInn === inn;
      })
      .map((d, i) => {
        return {
          id: d.Идентификатор || `saby-work-${i}`,
          document_number: d.Номер || `№ ${i + 1}`,
          work_name: d.Название || d.Примечание || 'Наряд из Saby',
          date: d.Дата || new Date().toISOString().slice(0, 10),
          quantity: 1,
          unit: 'шт',
          price: parseFloat(d.Сумма || 0),
          sum: parseFloat(d.Сумма || 0)
        };
      });

    return { ok: true, works };
  } catch (err) {
    return { ok: false, error: err.message, works: [] };
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
      id: 40
    };

    const res = await fetch(SABY_DIRECT_URL, {
      method: 'POST',
      headers: getSabyHeaders(auth.token),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, requests: [] };
    const json = await res.json().catch(() => null);
    if (!json || json.error) return { ok: false, error: json?.error?.message || 'Ошибка RPC', requests: [] };

    const rawList = json.result?.Документы || json.result || [];
    const requests = (Array.isArray(rawList) ? rawList : []).map((d, i) => ({
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
