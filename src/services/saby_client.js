import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settingsManager } from '../config/settings_manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SABY_RPC_URL = 'https://online.sbis.ru/service/sbis-rpc.service';

export function getSabyCredentials() {
  const conf = settingsManager ? settingsManager.getRawSettings() : {};
  let clientId = (process.env.SABY_APP_CLIENT_ID || conf.saby_app_client_id || '').trim();
  let appSecret = (process.env.SABY_APP_SECRET || conf.saby_app_secret || '').trim();
  let secretKey = (process.env.SABY_SECRET_KEY || conf.saby_secret_key || '').trim();

  // Also check .saby_config files
  const candidates = [
    path.join(__dirname, '.saby_config'),
    path.join(process.cwd(), '.saby_config'),
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

export async function fetchEgrulCompany(inn) {
  try {
    const res = await fetch(`https://egrul.itsoft.ru/${inn}.json`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(1500),
      redirect: 'follow'
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ul = data.СвЮЛ || data.СвИП || data;
    if (!ul) return null;

    let name = '';
    if (ul.СвНаимЮЛ) {
      name = ul.СвНаимЮЛ['@attributes']?.НаимЮЛСокр || ul.СвНаимЮЛ['@attributes']?.НаимЮЛПолн || '';
    } else if (ul.СвФЛ) {
      const f = ul.СвФЛ['@attributes'] || ul.СвФЛ;
      name = `ИП ${[f.Фамилия, f.Имя, f.Отчество].filter(Boolean).join(' ')}`.trim();
    } else if (ul.ФИОИП) {
      name = `ИП ${ul.ФИОИП}`;
    }

    const attrs = ul['@attributes'] || {};
    const kpp = attrs.КПП || (ul.СвУчетНО ? ul.СвУчетНО['@attributes']?.КПП : '') || '';
    const ogrn = attrs.ОГРН || attrs.ОГРНИП || '';

    let director = '';
    if (ul.СведДолжн) {
      const dolzh = Array.isArray(ul.СведДолжн) ? ul.СведДолжн[0] : ul.СведДолжн;
      const fio = dolzh?.СвФЛ?.['@attributes'] || {};
      director = `${fio.Фамилия || ''} ${fio.Имя || ''} ${fio.Отчество || ''}`.trim();
    }

    let address = '';
    if (ul.СвАдресЮЛ) {
      const adr = ul.СвАдресЮЛ.АдресРФ || ul.СвАдресЮЛ;
      if (typeof adr === 'string') address = adr;
      else if (adr && adr['@attributes']) {
        const a = adr['@attributes'];
        address = [a.Индекс, a.Регион, a.Город, a.Улица, a.Дом].filter(Boolean).join(', ');
      }
    }

    if (name) {
      return {
        name,
        inn,
        kpp,
        ogrn,
        director,
        address: address || 'Данные из реестра ЕГРЮЛ'
      };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export async function searchSabyCompany(query) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'Запрос пуст', items: [] };

  const isInn = /^\d{10}$|^\d{12}$/.test(q);
  const auth = await authenticateSaby();
  
  if (auth.ok) {
    const endpoints = [
      'https://online.sbis.ru/service/?srv=1',
      SABY_RPC_URL
    ];

    const payloads = [];
    if (isInn) {
      payloads.push(
        {
          jsonrpc: '2.0',
          method: 'СБИС.ИнформацияОКонтрагенте',
          params: {
            Фильтр: {
              Контрагент: q.length === 10 ? { СвЮЛ: { ИНН: q } } : { СвФЛ: { ИНН: q } }
            }
          },
          id: 2
        },
        {
          jsonrpc: '2.0',
          method: 'СБИС.ИнформацияОКонтрагенте',
          params: { Реквизиты: { ИНН: q } },
          id: 3
        },
        {
          jsonrpc: '2.0',
          method: 'СБИС.СписокКонтрагентов',
          params: { Фильтр: { СтрокаПоиска: q } },
          id: 4
        }
      );
    } else {
      payloads.push(
        {
          jsonrpc: '2.0',
          method: 'СБИС.СписокКонтрагентов',
          params: { Фильтр: { СтрокаПоиска: q } },
          id: 5
        },
        {
          jsonrpc: '2.0',
          method: 'СБИС.ИнформацияОКонтрагенте',
          params: { Фильтр: { Название: q } },
          id: 6
        }
      );
    }

    for (const url of endpoints) {
      for (const payload of payloads) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json-rpc; charset=utf-8',
              'X-SBISAccessToken': auth.token || '',
              'X-SBISSessionID': auth.token || ''
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(6000)
          });

          if (!res.ok) continue;

          const json = await res.json();
          if (json.result && !json.error) {
            const r = json.result;
            // Case 1: single counterparty object
            const name = r.Название || r.КраткоеНаименование || r.ПолноеНаименование || r.name;
            if (name) {
              return {
                ok: true,
                company: {
                  name,
                  inn: r.ИНН || r.inn || (isInn ? q : ''),
                  kpp: r.КПП || r.kpp || '',
                  ogrn: r.ОГРН || r.ogrn || '',
                  director: r.Руководитель || r.director || '',
                  address: r.ЮридическийАдрес || r.Адрес || r.address || ''
                }
              };
            }

            // Case 2: list of counterparties
            const list = Array.isArray(r) ? r : (r.Список || r.Контрагенты || r.rows || []);
            if (Array.isArray(list) && list.length > 0) {
              const first = list[0];
              const fName = first.Название || first.КраткоеНаименование || first.name;
              if (fName) {
                return {
                  ok: true,
                  company: {
                    name: fName,
                    inn: first.ИНН || first.inn || (isInn ? q : ''),
                    kpp: first.КПП || first.kpp || '',
                    ogrn: first.ОГРН || first.ogrn || '',
                    director: first.Руководитель || first.director || '',
                    address: first.ЮридическийАдрес || first.Адрес || ''
                  },
                  items: list.map(item => ({
                    name: item.Название || item.КраткоеНаименование || item.name,
                    inn: item.ИНН || item.inn || '',
                    kpp: item.КПП || item.kpp || '',
                    ogrn: item.ОГРН || item.ogrn || '',
                    director: item.Руководитель || item.director || '',
                    address: item.ЮридическийАдрес || item.Адрес || ''
                  }))
                };
              }
            }
          }
        } catch (err) {
          // try next
        }
      }
    }
  }

  // Fallback if query is an INN: public EGRUL/EGRIP registry
  if (isInn) {
    const egrul = await fetchEgrulCompany(q);
    if (egrul) {
      return {
        ok: true,
        company: egrul
      };
    }
  }

  return { ok: false, error: 'Организация не найдена в Saby и реестре ЕГРЮЛ', items: [] };
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
