import fs from 'fs';
let code = fs.readFileSync('saby_client.js', 'utf8');

// Modify authenticateSaby
const oldAuth = `  try {
    const authParams = {
      app_client_id: creds.clientId,
      app_secret: creds.appSecret
    };
    if (creds.secretKey && creds.secretKey.trim() !== '') {
      authParams.secret_key = creds.secretKey;
    }

    const payload = {
      jsonrpc: '2.0',
      method: 'СБИС.Аутентифицировать',
      params: {
        Параметр: authParams
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
    });`;

const newAuth = `  try {
    const authParams = {
      app_client_id: creds.clientId,
      app_secret: creds.appSecret
    };
    if (creds.secretKey && creds.secretKey.trim() !== '') {
      authParams.secret_key = creds.secretKey;
    }

    // Use OAuth endpoint instead of JSON-RPC
    const res = await fetch('https://online.sbis.ru/oauth/service/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(authParams),
      signal: AbortSignal.timeout(8000)
    });`;

code = code.replace(oldAuth, newAuth);

// Fix the token extraction
const oldTokenExtraction = `    const json = await res.json();
    if (json.error) {
      return {
        ok: false,
        configured: true,
        message: \`Ошибка Saby RPC [\${json.error.code || ''}]: \${json.error.message || json.error.details || JSON.stringify(json.error)}\`
      };
    }

    const token = json.result || 'saby-session-active';`;

const newTokenExtraction = `    const json = await res.json();
    if (json.error) {
      return {
        ok: false,
        configured: true,
        message: \`Ошибка Saby OAuth [\${json.error_code || ''}]: \${json.error_message || json.error.message || JSON.stringify(json.error)}\`
      };
    }

    // oauth/service returns { access_token: "...", sid: "..." }
    const token = json.access_token || json.sid || json.result || 'saby-session-active';`;

code = code.replace(oldTokenExtraction, newTokenExtraction);

// Fix headers in other functions: 'X-SBIS-Session' -> 'X-SBISAccessToken' (try both or just X-SBISAccessToken? The docs said X-SBISAccessToken)
// Let's replace 'X-SBIS-Session' with 'X-SBISSessionId' and 'X-SBISAccessToken'
code = code.replace(/'X-SBIS-Session': auth\.token \|\| ''/g, "'X-SBISAccessToken': auth.token || ''");

fs.writeFileSync('saby_client.js', code);
