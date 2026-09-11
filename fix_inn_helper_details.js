import fs from 'fs';
let code = fs.readFileSync('inn_helper.js', 'utf8');

const oldMap = `const comp = rpcData.result;
            const name = comp.НаименованиеПолное || comp.НаименованиеСокращенное || comp.ФИОПолное;
            if (name) {
              return [{ name, inn: query, address: comp.Адрес || '' }];
            }`;

const newMap = `const comp = rpcData.result;
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
            }`;

code = code.replace(oldMap, newMap);

const oldArrayMap = `return rpcData.result.Контрагенты.map(c => ({
              name: c.НаименованиеПолное || c.НаименованиеСокращенное || c.ФИОПолное,
              inn: c.ИНН || '',
              address: c.Адрес || ''
            }));`;

const newArrayMap = `return rpcData.result.Контрагенты.map(c => ({
              name: c.Название || c.НаименованиеСокращенное || c.НаименованиеПолное || c.ФИОПолное,
              inn: c.ИНН || '',
              kpp: c.КПП || '',
              ogrn: c.ОГРН || '',
              director: c.Руководитель || '',
              address: c.ЮридическийАдрес || c.Адрес || ''
            }));`;

code = code.replace(oldArrayMap, newArrayMap);

fs.writeFileSync('inn_helper.js', code);
