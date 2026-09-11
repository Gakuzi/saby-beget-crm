import fs from 'fs';
let code = fs.readFileSync('sqlite_db.js', 'utf8');

// Add new tables
const newTables = `
      CREATE TABLE IF NOT EXISTS client_hosting_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        provider_name TEXT NOT NULL,
        provider_url TEXT,
        login TEXT,
        password TEXT,
        api_key TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS client_sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        hosting_account_id INTEGER,
        url TEXT NOT NULL,
        cms_type TEXT DEFAULT '1C-Bitrix',
        cms_login TEXT,
        cms_password TEXT,
        ssh_host TEXT,
        ssh_user TEXT,
        ssh_password TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (hosting_account_id) REFERENCES client_hosting_accounts(id) ON DELETE SET NULL
      );
`;

code = code.replace(/CREATE TABLE IF NOT EXISTS system_settings \([^;]+\);/s, match => match + '\n' + newTables);

// Add reset database method
const resetMethod = `
  resetDatabase() {
    this.db.exec(\`
      DELETE FROM work_logs;
      DELETE FROM client_credentials;
      DELETE FROM client_contacts;
      DELETE FROM backups;
      DELETE FROM host_events;
      DELETE FROM saby_docs;
      DELETE FROM tickets;
      DELETE FROM billing_events;
      DELETE FROM client_sites;
      DELETE FROM client_hosting_accounts;
      DELETE FROM clients;
    \`);
  }
`;

code = code.replace(/ensureAdminUser\(\) \{/, resetMethod + '\n  ensureAdminUser() {');

// Add methods to manage sites and hostings
const siteMethods = `
  // --- Hosting & Sites Management ---
  getHostingAccounts(clientId) {
    return this.db.prepare('SELECT * FROM client_hosting_accounts WHERE client_id = ? ORDER BY provider_name').all(clientId);
  }

  addHostingAccount(clientId, data) {
    const now = new Date().toISOString();
    const result = this.db.prepare(\`
      INSERT INTO client_hosting_accounts (
        client_id, provider_name, provider_url, login, password, api_key, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`).run(
      clientId, data.provider_name || 'Beget', data.provider_url || '', data.login || '', 
      data.password || '', data.api_key || '', data.notes || '', now, now
    );
    return result.lastInsertRowid;
  }
  
  deleteHostingAccount(id) {
    this.db.prepare('DELETE FROM client_hosting_accounts WHERE id = ?').run(id);
  }

  getSites(clientId) {
    return this.db.prepare('SELECT * FROM client_sites WHERE client_id = ? ORDER BY url').all(clientId);
  }

  addSite(clientId, data) {
    const now = new Date().toISOString();
    const result = this.db.prepare(\`
      INSERT INTO client_sites (
        client_id, hosting_account_id, url, cms_type, cms_login, cms_password, ssh_host, ssh_user, ssh_password, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`).run(
      clientId, data.hosting_account_id || null, data.url, data.cms_type || '1C-Bitrix', 
      data.cms_login || '', data.cms_password || '', data.ssh_host || '', 
      data.ssh_user || '', data.ssh_password || '', data.notes || '', now, now
    );
    return result.lastInsertRowid;
  }
  
  deleteSite(id) {
    this.db.prepare('DELETE FROM client_sites WHERE id = ?').run(id);
  }
`;

code = code.replace(/getClientSites\(clientId\) \{/, siteMethods + '\n  getClientSites(clientId) {');

fs.writeFileSync('sqlite_db.js', code);
