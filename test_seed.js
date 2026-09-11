import { db } from './crm_store.js';

try {
    const clientId = db.addClient({
      inn: '7736207543',
      company_name: 'ООО "Яндекс" (Тестовый клиент)',
      email_reports: 'reports@yandex.ru',
      sites: 'yandex.ru',
      saby_contract_id: 'test-doc-123',
      saby_contract_number: '№ 123-ТЕСТ',
      monthly_fee: 150000,
      contract_start_date: new Date().toISOString().slice(0, 10)
    });
    console.log("clientId:", clientId);
} catch (e) {
    console.error(e);
}
