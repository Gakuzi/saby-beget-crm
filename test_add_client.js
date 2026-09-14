import { sqliteDb } from './src/db/sqlite_db.js';
try {
  sqliteDb.addContact(1, { name: 'Test', position: '', email: 'test@example.com', phone: '', role: 'staff' });
  console.log('addContact ok');
} catch (e) {
  console.log('addContact err:', e);
}
