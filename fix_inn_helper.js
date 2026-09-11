import fs from 'fs';
let code = fs.readFileSync('inn_helper.js', 'utf8');

const oldSabyCall = `  // If live Saby credentials exist, attempt Saby RPC
  const sabyClientId = process.env.SABY_APP_CLIENT_ID;
  const sabySecret = process.env.SABY_APP_SECRET;
  const sabyKey = process.env.SABY_SECRET_KEY;

  if (sabyClientId && sabySecret && sabyKey) {
    try {
      // Live Saby API call
      const authRes = await fetch('https://online.sbis.ru/oauth/service/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_client_id: sabyClientId,
          app_secret: sabySecret,
          secret_key: sabyKey
        })
      });
      const authData = await authRes.json();
      if (authData.token) {
        const contractorObj = query.length === 10 ? { СвЮЛ: { ИНН: query } } : { СвФЛ: { ИНН: query } };
        const rpcRes = await fetch('https://online.sbis.ru/service/sbis-rpc.service', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-SBISAccessToken': authData.token
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: query.match(/^\\d+$/)
              ? 'СБИС.Контрагенты.ПолучитьИнформациюОКонтрагенте'
              : 'СБИС.Контрагенты.НайтиКонтрагентов',
            params: query.match(/^\\d+$/)
              ? { Контрагент: contractorObj }
              : { Поиск: query, РазмерСтраницы: 6 },
            id: 1
          })
        });`;

const newSabyCall = `  // Use shared authenticateSaby
  const { authenticateSaby } = await import('./saby_client.js');
  
  try {
    const auth = await authenticateSaby();
    if (auth.ok) {
      // Live Saby API call
      const rpcRes = await fetch('https://online.sbis.ru/service/sbis-rpc.service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-SBISAccessToken': auth.token
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: query.match(/^\\d+$/)
            ? 'СБИС.ИнформацияОКонтрагенте'
            : 'СБИС.СписокКонтрагентов',
          params: query.match(/^\\d+$/)
            ? { Реквизиты: { ИНН: query } }
            : { Фильтр: { СтрокаПоиска: query } },
          id: 1
        })
      });`;

code = code.replace(oldSabyCall, newSabyCall);

fs.writeFileSync('inn_helper.js', code);
