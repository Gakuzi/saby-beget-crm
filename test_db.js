import { sqliteDb } from './src/db/sqlite_db.js';
try {
  console.log('Testing addClient...');
  const newClient = sqliteDb.addClient({
    inn: '1234567890',
    company_name: 'Test Company',
    email_reports: '',
    sites: '',
    saby_contract_id: '',
    saby_contract_number: ''
  });
  console.log('Success!', newClient);
} catch (e) {
  console.error('Error in addClient:', e);
}
