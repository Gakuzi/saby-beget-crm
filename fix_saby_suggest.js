import fs from 'fs';
let code = fs.readFileSync('inn_helper.js', 'utf8');

const sabyBlock = `  const { authenticateSaby } = await import('./saby_client.js');
    
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
      } else if (rpcData.error) {
         console.warn('Saby suggest error returned from RPC:', rpcData.error);
      }
    } else {
       console.warn('Saby auth failed in suggestCompany:', auth.error);
    }
  } catch (err) {
    console.warn('Saby RPC error in suggestCompany:', err.message);
  }
`;

// Replace existing Saby block with one that logs
const oldSabyBlockRegex = /const \{ authenticateSaby \}[\s\S]*?console\.warn\('Saby RPC error:', err\.message\);\s*\}/;
code = code.replace(oldSabyBlockRegex, sabyBlock.trim());

// Local fallback - we can make it clear it's from local DB so the user knows
code = code.replace(
  "address: 'Из вашей локальной базы'",
  "address: '⚠️ (Из локальной базы - Saby недоступен)'"
);

fs.writeFileSync('inn_helper.js', code);
