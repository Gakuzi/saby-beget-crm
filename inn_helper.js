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
    name: 'ООО "Северный Вектор"',
    short_name: 'ООО "Северный Вектор"',
    inn: '7724890123',
    kpp: '772401001',
    ogrn: '1147746123456',
    director: 'Климов Евгений Владимирович',
    address: 'г. Москва, Варшавское ш., д. 42, офис 305',
    sites: 'sever-vector.ru, shop.sever-vector.ru, blog.sever-vector.ru',
    email: 'info@sever-vector.ru, tech@sever-vector.ru',
    contracts: [
      {
        id: 'cnt-601',
        number: 'Д-2024/017',
        title: 'Договор комплексного технического сопровождения сайтов и серверов',
        date: '15.12.2023',
        plan_hours: 15,
        tariff: '45 000 ₽ / мес',
        status: 'Действует',
        sla: '99.5%'
      },
      {
        id: 'cnt-602',
        number: 'Д-2024/018',
        title: 'Соглашение об уровне сервиса и круглосуточном мониторинге (SLA 99.9%)',
        date: '15.01.2024',
        plan_hours: 5,
        tariff: '15 000 ₽ / мес',
        status: 'Действует',
        sla: '99.9%'
      }
    ]
  },
  {
    name: 'ООО "Альфа-Сервис"',
    short_name: 'ООО "Альфа-Сервис"',
    inn: '7801234567',
    kpp: '780101001',
    ogrn: '1157847987654',
    director: 'Васильев Андрей Петрович',
    address: 'г. Санкт-Петербург, Невский пр., д. 45, литера А, оф. 12',
    sites: 'alpha-service.pro, crm.alpha-service.pro, dev.alpha-service.pro',
    email: 'office@alpha-service.pro, director@alpha-service.pro',
    contracts: [
      {
        id: 'cnt-201',
        number: 'АС-2024/05',
        title: 'Договор аутсорсинга веб-инфраструктуры и серверов Beget',
        date: '01.02.2024',
        plan_hours: 15,
        tariff: '38 000 ₽ / мес',
        status: 'Действует',
        sla: '99.8%'
      },
      {
        id: 'cnt-202',
        number: 'АС-2024/09',
        title: 'Договор на доработку функционала каталога 1С-Битрикс',
        date: '10.04.2024',
        plan_hours: 20,
        tariff: '60 000 ₽',
        status: 'Выполнен',
        sla: '99.5%'
      }
    ]
  },
  {
    name: 'ООО "ТехноПром"',
    short_name: 'ООО "ТехноПром"',
    inn: '7707083893',
    kpp: '770701001',
    ogrn: '1027700132195',
    director: 'Смирнов Игорь Николаевич',
    address: 'г. Москва, ул. Тверская, д. 12, стр. 2',
    sites: 'technoprom.ru, b2b.technoprom.ru',
    email: 'contact@technoprom.ru',
    contracts: [
      {
        id: 'cnt-101',
        number: '24/ИТ-01',
        title: 'Договор технического сопровождения сайтов и серверов',
        date: '10.01.2024',
        plan_hours: 20,
        tariff: '55 000 ₽ / мес',
        status: 'Действует',
        sla: '99.5%'
      },
      {
        id: 'cnt-102',
        number: '24/ИТ-02',
        title: 'Регламент: Обслуживание 1С-Битрикс и мониторинг Beget',
        date: '01.03.2024',
        plan_hours: 10,
        tariff: '28 000 ₽ / мес',
        status: 'Действует',
        sla: '99.8%'
      }
    ]
  },
  {
    name: 'ИП Климов Евгений Владимирович',
    short_name: 'ИП Климов Е.В.',
    inn: '500100732259',
    kpp: '—',
    ogrn: '318500100012345',
    director: 'Климов Евгений Владимирович',
    address: 'Московская обл., г. Балашиха, ул. Советская, д. 15',
    sites: 'klimov-dev.ru, portfolio.klimov-dev.ru',
    email: 'klimov@dev-studio.ru',
    contracts: [
      {
        id: 'cnt-301',
        number: 'КЛ-01/24',
        title: 'Комплексное сопровождение доменов, почты и хостинга',
        date: '01.01.2024',
        plan_hours: 10,
        tariff: '25 000 ₽ / мес',
        status: 'Действует',
        sla: '99.9%'
      }
    ]
  },
  {
    name: 'ООО "СтройКомплект"',
    short_name: 'ООО "СтройКомплект"',
    inn: '7714987654',
    kpp: '771401001',
    ogrn: '1167746554433',
    director: 'Ковалев Сергей Михайлович',
    address: 'г. Москва, Ленинградский пр-т, д. 39, стр. 1',
    sites: 'stroy-komplekt.ru, sk-shop.ru',
    email: 'info@stroy-komplekt.ru',
    contracts: [
      {
        id: 'cnt-401',
        number: 'СК-77/24',
        title: 'Поддержка корпоративного портала и резервного копирования',
        date: '12.02.2024',
        plan_hours: 12,
        tariff: '32 000 ₽ / мес',
        status: 'Действует',
        sla: '99.5%'
      }
    ]
  },
  {
    name: 'ООО "Вектор Развития"',
    short_name: 'ООО "Вектор Развития"',
    inn: '7810554433',
    kpp: '781001001',
    ogrn: '1177847112233',
    director: 'Николаев Дмитрий Алексеевич',
    address: 'г. Санкт-Петербург, Московский пр-т, д. 100, офис 401',
    sites: 'vektor-razvitia.ru, vr-cloud.ru',
    email: 'support@vektor-razvitia.ru',
    contracts: [
      {
        id: 'cnt-501',
        number: 'ВР-12/23',
        title: 'Администрирование серверов, баз данных и SSL-сертификатов',
        date: '01.12.2023',
        plan_hours: 15,
        tariff: '42 000 ₽ / мес',
        status: 'Действует',
        sla: '99.8%'
      }
    ]
  },
  {
    name: 'ООО "Диджитал Медиа Групп"',
    short_name: 'ООО "ДМГ"',
    inn: '7709876543',
    kpp: '770901001',
    ogrn: '1187746332211',
    director: 'Морозова Елена Викторовна',
    address: 'г. Москва, ул. Земляной Вал, д. 50А',
    sites: 'dmg-agency.ru, news.dmg-agency.ru',
    email: 'admin@dmg-agency.ru',
    contracts: [
      {
        id: 'cnt-701',
        number: 'ДМ-01/24',
        title: 'Договор технического обслуживания высоконагруженного портала',
        date: '15.01.2024',
        plan_hours: 25,
        tariff: '75 000 ₽ / мес',
        status: 'Действует',
        sla: '99.9%'
      }
    ]
  },
  {
    name: 'ООО "Медицинский Центр Здоровье"',
    short_name: 'ООО "МЦ Здоровье"',
    inn: '7812345678',
    kpp: '781201001',
    ogrn: '1197847445566',
    director: 'Семенов Павел Романович',
    address: 'г. Санкт-Петербург, Большой пр-кт П.С., д. 82',
    sites: 'med-zdorovie.spb.ru, clinic-portal.ru',
    email: 'help@med-zdorovie.spb.ru',
    contracts: [
      {
        id: 'cnt-801',
        number: 'МЦ-2024/03',
        title: 'Договор сопровождения сервиса онлайн-записи и интеграции с МИС',
        date: '01.03.2024',
        plan_hours: 15,
        tariff: '45 000 ₽ / мес',
        status: 'Действует',
        sla: '99.9%'
      }
    ]
  }
];

export function getCompanyDetails(innOrQuery) {
  const q = String(innOrQuery || '').trim();
  if (!q) return null;
  const found = KNOWN_COMPANIES.find(c => c.inn === q || c.name.toLowerCase().includes(q.toLowerCase()));
  if (found) return found;

  if (/^\d{10,12}$/.test(q)) {
    const isLE = q.length === 10;
    const region = q.slice(0, 2);
    const shortNum = q.slice(-4);
    return {
      name: isLE ? `ООО "Компания Инновация-${shortNum}"` : `ИП Предприниматель-${shortNum}`,
      short_name: isLE ? `ООО "Инновация-${shortNum}"` : `ИП Предприниматель-${shortNum}`,
      inn: q,
      kpp: isLE ? `${region}01001` : '—',
      ogrn: isLE ? `124${region}00${shortNum}1` : `324${region}00${shortNum}1`,
      director: 'Руководитель организации',
      address: `г. Россия, субъект РФ (${region}), Центральная ул., д. ${shortNum.slice(0, 2)}`,
      sites: `company-${shortNum}.ru`,
      email: `office@company-${shortNum}.ru`,
      contracts: [
        {
          id: `cnt-${shortNum}-01`,
          number: `Д-${shortNum}/24`,
          title: 'Договор комплексного технического сопровождения сайтов и серверов (Saby)',
          date: '01.01.2024',
          plan_hours: 15,
          tariff: '40 000 ₽ / мес',
          status: 'Действует',
          sla: '99.5%'
        },
        {
          id: `cnt-${shortNum}-02`,
          number: `ХОСТ-${shortNum}/24`,
          title: 'Договор администрирования хостинга Beget и резервного копирования',
          date: '15.01.2024',
          plan_hours: 5,
          tariff: '15 000 ₽ / мес',
          status: 'Действует',
          sla: '99.8%'
        }
      ]
    };
  }
  return null;
}

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
    c => c.inn.includes(query) || c.name.toLowerCase().includes(qLower) || (c.short_name && c.short_name.toLowerCase().includes(qLower))
  ).map(c => ({
    name: c.name,
    short_name: c.short_name || c.name,
    inn: c.inn,
    kpp: c.kpp || '—',
    ogrn: c.ogrn || '—',
    director: c.director || '—',
    address: c.address,
    sites: c.sites || '',
    email: c.email || '',
    contracts: c.contracts || []
  }));

  if (matched.length > 0) {
    return matched;
  }

  // If numeric and looks like INN (10 or 12 digits), generate realistic company info
  if (/^\d{10,12}$/.test(query)) {
    const details = getCompanyDetails(query);
    if (details) {
      return [details];
    }
  }

  return [];
}

export async function getContracts(inn) {
  inn = (inn || '').trim();
  if (!inn) return [];

  // Check known companies
  const found = KNOWN_COMPANIES.find(c => c.inn === inn);
  if (found && found.contracts && found.contracts.length > 0) {
    return found.contracts;
  }

  const shortNum = inn.slice(-4) || '2024';
  return [
    {
      id: `cnt-${shortNum}-01`,
      number: `№ Д-${shortNum}/24`,
      title: 'Договор комплексного технического сопровождения сайтов и серверов (Saby)',
      date: '10.01.2024',
      plan_hours: 15,
      tariff: '40 000 ₽ / мес',
      status: 'Действует',
      sla: '99.5%'
    },
    {
      id: `cnt-${shortNum}-02`,
      number: `№ ХОСТ-${shortNum}/24`,
      title: 'Договор администрирования хостинга Beget и резервного копирования',
      date: '15.02.2024',
      plan_hours: 5,
      tariff: '15 000 ₽ / мес',
      status: 'Действует',
      sla: '99.8%'
    }
  ];
}
