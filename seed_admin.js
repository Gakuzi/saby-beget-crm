import { db } from './crm_store.js';

try {
  // Check if admin exists
  const admin = db.db.prepare("SELECT * FROM admin_users WHERE email = 'EKlimov84@gmail.com' OR email = 'eklimov84@gmail.com'").get();
  if (!admin) {
    const { hash, salt } = db.hashPassword('123456');
    db.db.prepare('INSERT INTO admin_users (username, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'Евгений Климов', 'eklimov84@gmail.com', hash, salt, new Date().toISOString()
    );
    console.log('Admin seeded!');
  } else {
    console.log('Admin already exists.');
  }
} catch (e) {
  console.error(e);
}
