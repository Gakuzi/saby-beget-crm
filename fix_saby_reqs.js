import fs from 'fs';
let code = fs.readFileSync('saby_client.js', 'utf8');

code = code.replace(
  "hasCredentials: !!(clientId && appSecret)",
  "hasCredentials: !!(clientId && appSecret && secretKey)"
);

code = code.replace(
  "message: 'Учетные данные Saby API не настроены (требуются SABY_APP_CLIENT_ID и SABY_APP_SECRET).'",
  "message: 'Учетные данные Saby API не настроены (требуются ID подключения, Защищенный ключ и Сервисный ключ).'"
);

fs.writeFileSync('saby_client.js', code);
