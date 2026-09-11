import { authenticateSaby } from './saby_client.js';

async function run() {
  const auth = await authenticateSaby();
  const payload = {
    jsonrpc: '2.0',
    method: 'СБИС.СписокКонтрагентов',
    params: {
      Параметры: {
        СтрокаПоиска: "Озон"
      }
    },
    id: 1
  };
  const res = await fetch('https://online.sbis.ru/service/sbis-rpc.service', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json-rpc; charset=utf-8', 'X-SBISAccessToken': auth.token },
    body: JSON.stringify(payload)
  });
  console.log(await res.json());
}
run();
