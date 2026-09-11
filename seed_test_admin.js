import { db } from './crm_store.js';
const { hash, salt } = db.hashPassword('test1234');
db.db.prepare('INSERT INTO admin_users (username, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
  'test', 'test@test.com', hash, salt, new Date().toISOString()
);
