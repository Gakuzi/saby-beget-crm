import fs from 'fs';
let code = fs.readFileSync('sqlite_db.js', 'utf8');

const target = "  // --- 2FA Verification Codes ---";
const replacement = `  // --- Passkeys / WebAuthn ---
  savePasskey(passkey) {
    this.db.prepare(\`
      INSERT INTO admin_passkeys (id, admin_id, public_key, counter, device_type, backed_up, transports, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    \`).run(passkey.id, passkey.admin_id, passkey.public_key, passkey.counter, passkey.device_type, passkey.backed_up ? 1 : 0, passkey.transports, new Date().toISOString());
  }

  getPasskey(id) {
    return this.db.prepare('SELECT * FROM admin_passkeys WHERE id = ?').get(id);
  }
  
  updatePasskeyCounter(id, counter) {
    this.db.prepare('UPDATE admin_passkeys SET counter = ? WHERE id = ?').run(counter, id);
  }

  getAdminPasskeys(admin_id) {
    return this.db.prepare('SELECT * FROM admin_passkeys WHERE admin_id = ?').all(admin_id);
  }

  // --- 2FA Verification Codes ---`;

code = code.replace(target, replacement);
fs.writeFileSync('sqlite_db.js', code);
