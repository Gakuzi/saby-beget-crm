import fs from 'fs';
let code = fs.readFileSync('sqlite_db.js', 'utf8');

code = code.replace(
  /CREATE TABLE IF NOT EXISTS admin_users \(/,
  `CREATE TABLE IF NOT EXISTS admin_passkeys (
        id TEXT PRIMARY KEY,
        admin_id INTEGER,
        public_key TEXT,
        counter INTEGER,
        device_type TEXT,
        backed_up INTEGER,
        transports TEXT,
        created_at TEXT
      );
      
      CREATE TABLE IF NOT EXISTS admin_users (`
);

fs.writeFileSync('sqlite_db.js', code);
