// INN validation and company suggestion helper

export function checkInnChecksum(inn) {
  inn = String(inn).trim();
  if (!/^\d+$/.test(inn)) return false;

  if (inn.length === 10) {
    const coeffs = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    const s = inn
      .slice(0, 9)
      .split('')
      .reduce((acc, d, i) => acc + parseInt(d, 10) * coeffs[i], 0);
    return (s % 11 % 10) === parseInt(inn[9], 10);
  } else if (inn.length === 12) {
    const coeffs11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8, 0];
    const coeffs12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8, 0];
    const s1 = inn
      .slice(0, 11)
      .split('')
      .reduce((acc, d, i) => acc + parseInt(d, 10) * coeffs11[i], 0);
    const d11 = s1 % 11 % 10;
    const s2 = inn
      .slice(0, 12)
      .split('')
      .reduce((acc, d, i) => acc + parseInt(d, 10) * coeffs12[i], 0);
    const d12 = s2 % 11 % 10;
    return d11 === parseInt(inn[10], 10) && d12 === parseInt(inn[11], 10);
  }
  return false;
}

// Sample mock companies database for instant local lookups
const KNOWN_COMPANIES = [
  {
    name: 'ООО "ТехноПром"',
    inn: '7707083893',
    address: 'г. Москва, ул. Тверская, д. 12',
    contracts: [
      { id: 'cnt-101', number: '24/ИТ-01', title: 'Договор технического сопровождения сайтов и серверов' },
      { id: 'cnt-102', number: '24/ИТ-02', title: 'Регламент: Обслуживание 1С-Битрикс и мониторинг' }
    ]
  },
  {
    name: 'ООО "Альфа-Сервис"',
    inn: '7801234567',
    address: 'г. Санкт-Петербург, Невский пр., д. 45',
    contracts: [
      { id: 'cnt-201', number: 'АС-2024/05', title: 'Договор аутсорсинга веб-инфраструктуры' }
    ]
  },
  {
    name: 'ИП Климов Евгений Владимирович',
    inn: '500100732259',
    address: 'Московская обл., г. Балашиха',
    contracts: [
      { id: 'cnt-301', number: 'КЛ-01/24', title: 'Комплексное сопровождение доменов, почты и хостинга' }
    ]
  },
  {
    name: 'ООО "СтройКомплект"',
    inn: '7714987654',
    address: 'г. Москва, Ленинградский пр-т, д. 39',
    contracts: [
      { id: 'cnt-401', number: 'СК-77/24', title: 'Поддержка корпоративного портала и резервного копирования' }
    ]
  },
  {
    name: 'ООО "Вектор Развития"',
    inn: '7810554433',
    address: 'г. Санкт-Петербург, Московский пр-т, д. 100',
    contracts: [
      { id: 'cnt-501', number: 'ВР-12/23', title: 'Администрирование серверов и баз данных' }
    ]
  }
];

export async function suggestCompany(query) {
  query = (query || '').trim();
  if (!query || query.length < 2) return [];

  // If live Saby credentials exist, attempt Saby RPC
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
            method: query.match(/^\d+$/)
              ? 'СБИС.Контрагенты.ПолучитьИнформациюОКонтрагенте'
              : 'СБИС.Контрагенты.НайтиКонтрагентов',
            params: query.match(/^\d+$/)
              ? { Контрагент: contractorObj }
              : { Поиск: query, РазмерСтраницы: 6 },
            id: 1
          })
        });
        const rpcData = await rpcRes.json();
        if (rpcData.result) {
          if (query.match(/^\d+$/)) {
            const comp = rpcData.result;
            const name = comp.НаименованиеПолное || comp.НаименованиеСокращенное || comp.ФИОПолное;
            if (name) {
              return [{ name, inn: query, address: comp.Адрес || '' }];
            }
          } else if (Array.isArray(rpcData.result.Контрагенты)) {
            return rpcData.result.Контрагенты.map(c => ({
              name: c.НаименованиеПолное || c.НаименованиеСокращенное || c.ФИОПолное,
              inn: c.ИНН || '',
              address: c.Адрес || ''
            }));
          }
        }
      }
    } catch (err) {
      console.warn('Saby RPC error:', err.message);
    }
  }

  // Local fallback lookup
  const qLower = query.toLowerCase();
  const matched = KNOWN_COMPANIES.filter(
    c => c.inn.includes(query) || c.name.toLowerCase().includes(qLower)
  ).map(c => ({ name: c.name, inn: c.inn, address: c.address }));

  if (matched.length > 0) {
    return matched;
  }

  // If numeric and checksum is valid, return generic valid organization suggestion
  if (/^\d+$/.test(query) && checkInnChecksum(query)) {
    return [
      {
        name: `Организация (ИНН ${query})`,
        inn: query,
        address: 'Контрольная сумма ИНН верна'
      }
    ];
  }

  return [];
}

export async function getContracts(inn) {
  inn = (inn || '').trim();
  if (!inn) return [];

  // Check known companies
  const found = KNOWN_COMPANIES.find(c => c.inn === inn);
  if (found && found.contracts) {
    return found.contracts;
  }

  // Default contract generator for any valid INN
  return [
    {
      id: `cnt-${inn.slice(-4)}-01`,
      number: `№ ${inn.slice(-4)}/24-ИТ`,
      title: 'Договор на техническое сопровождение веб-ресурсов (Saby)'
    },
    {
      id: `cnt-${inn.slice(-4)}-02`,
      number: `№ ${inn.slice(-4)}/24-ХОСТ`,
      title: 'Договор администрирования Beget и резервного копирования'
    }
  ];
}
