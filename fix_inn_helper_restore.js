import fs from 'fs';

let code = `
import { db } from './crm_store.js';

export async function checkInnChecksum(inn) {
  if (typeof inn !== 'string' || !inn.match(/^\\d{10}$|^\\d{12}$/)) return false;
  if (inn.length === 10) {
    const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(inn[i]) * weights[i];
    return (sum % 11) % 10 === parseInt(inn[9]);
  } else {
    const weights11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const weights12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    let sum11 = 0, sum12 = 0;
    for (let i = 0; i < 10; i++) sum11 += parseInt(inn[i]) * weights11[i];
    let check11 = (sum11 % 11) % 10 === parseInt(inn[10]);
    for (let i = 0; i < 11; i++) sum12 += parseInt(inn[i]) * weights12[i];
    let check12 = (sum12 % 11) % 10 === parseInt(inn[11]);
    return check11 && check12;
  }
}

export async function suggestCompany(query) {
  query = (query || '').trim();
  if (!query || query.length < 2) return [];

  const { authenticateSaby } = await import('./saby_client.js');
  
  try {
    const auth = await authenticateSaby();
    if (auth.ok) {
      const contractorObj = query.length === 10 ? { СвЮЛ: { ИНН: query } } : { СвФЛ: { ИНН: query } };
      
      const rpcRes = await fetch('https://online.sbis.ru/service/sbis-rpc.service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-SBISAccessToken': auth.token
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
      });

      const rpcData = await rpcRes.json();
      if (rpcData.result) {
        if (query.match(/^\\d+$/)) {
          const comp = rpcData.result;
          const name = comp.Название || comp.НаименованиеСокращенное || comp.НаименованиеПолное || comp.ФИОПолное;
          if (name) {
            return [{ 
              name, 
              inn: comp.ИНН || query, 
              kpp: comp.КПП || '', 
              ogrn: comp.ОГРН || '', 
              director: comp.Руководитель || '',
              address: comp.ЮридическийАдрес || comp.Адрес || ''
            }];
          }
        } else if (Array.isArray(rpcData.result.Контрагенты)) {
          return rpcData.result.Контрагенты.map(c => ({
            name: c.Название || c.НаименованиеСокращенное || c.НаименованиеПолное || c.ФИОПолное,
            inn: c.ИНН || '',
            kpp: c.КПП || '',
            ogrn: c.ОГРН || '',
            director: c.Руководитель || '',
            address: c.ЮридическийАдрес || c.Адрес || ''
          }));
        }
      }
    }
  } catch (err) {
    console.warn('Saby RPC error:', err.message);
  }

  // Local fallback lookup
  const qLower = query.toLowerCase();
  const allClients = db.getClients('all');
  const matched = allClients.filter(c => c.company_name.toLowerCase().includes(qLower) || (c.inn && c.inn.includes(qLower)));
  
  return matched.slice(0, 5).map(c => ({
    name: c.company_name,
    inn: c.inn,
    address: 'Из вашей локальной базы'
  }));
}

export async function getContracts(inn) {
  if (!inn) return [];
  const { fetchSabyContracts } = await import('./saby_client.js');
  const result = await fetchSabyContracts(inn);
  if (result.ok && result.contracts) {
    return result.contracts;
  }
  return [];
}
`;

fs.writeFileSync('inn_helper.js', code);
