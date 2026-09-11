const BEGET_API_BASE = 'https://api.beget.com/api';

export function getBegetClientCredentials(client) {
  const login = (client?.beget_login || process.env.BEGET_LOGIN || '').trim();
  const password = (client?.beget_password || process.env.BEGET_PASSWORD || '').trim();
  const apiKey = (client?.beget_api_key || process.env.BEGET_API_KEY || '').trim();

  return {
    login,
    password,
    apiKey,
    hasCredentials: !!(login && (password || apiKey))
  };
}

export async function callBegetApi(method, client, extraParams = {}) {
  const creds = getBegetClientCredentials(client);
  if (!creds.hasCredentials) {
    return {
      ok: false,
      configured: false,
      error: 'Учетные данные Beget (логин и пароль/API-ключ) не указаны.'
    };
  }

  try {
    const params = new URLSearchParams({
      login: creds.login,
      passwd: creds.password,
      output_format: 'json',
      ...extraParams
    });

    const url = `${BEGET_API_BASE}${method}?${params.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Saby-Beget-CRM'
      },
      signal: AbortSignal.timeout(7000)
    });

    if (!res.ok) {
      return {
        ok: false,
        configured: true,
        status: res.status,
        error: `Beget API HTTP ${res.status}: ${res.statusText}`
      };
    }

    const data = await res.json();
    if (data.status === 'error') {
      return {
        ok: false,
        configured: true,
        error: data.error_text || data.error_code || 'Ошибка Beget API'
      };
    }

    return {
      ok: true,
      configured: true,
      answer: data.answer || data
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: `Ошибка запроса к Beget API (${method}): ${err.message}`
    };
  }
}

export async function testBegetConnection(client) {
  const res = await callBegetApi('/account/getInfo', client);
  return res;
}

export async function pullBegetSnapshot(client) {
  const accountRes = await callBegetApi('/account/getInfo', client);
  const backupsRes = await callBegetApi('/backup/getFileList', client);
  const domainsRes = await callBegetApi('/domain/getList', client);
  const sitesRes = await callBegetApi('/site/getList', client);

  return {
    account: accountRes.ok ? accountRes.answer : null,
    backups: backupsRes.ok ? backupsRes.answer : null,
    domains: domainsRes.ok ? domainsRes.answer : null,
    sites: sitesRes.ok ? sitesRes.answer : null,
    hasLiveConnection: accountRes.ok
  };
}
