import fs from 'fs';
let code = fs.readFileSync('saby_client.js', 'utf8');

const sabyPayload = `    const payload = {
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
    };`;

// The payload for app_client_id should conditionally include secret_key if it exists, otherwise omit it.
const sabyPayloadNew = `    const authParams = {
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
    };`;

code = code.replace(sabyPayload, sabyPayloadNew);

// Also fix the error message at the top of authenticateSaby
code = code.replace(
  "message: 'Учетные данные Saby API не настроены (требуются SABY_APP_CLIENT_ID, SABY_APP_SECRET, SABY_SECRET_KEY).'",
  "message: 'Учетные данные Saby API не настроены (требуются SABY_APP_CLIENT_ID и SABY_APP_SECRET).'"
);

// Modify getSabyCredentials to only require clientId and appSecret
const credsHasCheck = "hasCredentials: !!(clientId && appSecret && secretKey)";
const credsHasCheckNew = "hasCredentials: !!(clientId && appSecret)";

code = code.replace(credsHasCheck, credsHasCheckNew);

fs.writeFileSync('saby_client.js', code);
