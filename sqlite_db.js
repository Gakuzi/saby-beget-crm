// SQLite Database Engine for CRM & Infrastructure Management
import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'crm_server.sqlite3');
const JSON_BACKUP_PATH = path.join(DATA_DIR, 'crm_database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class SqliteDatabase {
  constructor() {
    this.db = new DatabaseSync(DB_PATH);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initTables();
    this.migrateFromJsonIfNeeded();
    this.ensureAdminUser();

    // Restrict file permissions to 0600 (owner only)
    try {
      fs.chmodSync(DB_PATH, 0o600);
    } catch (e) {
      // Ignore on systems where chmod is restricted
    }
  }

  initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        two_factor_enabled INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        last_login_at TEXT
      );

      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inn TEXT,
        kpp TEXT,
        ogrn TEXT,
        company_name TEXT NOT NULL,
        director TEXT,
        address TEXT,
        emails TEXT,
        email_reports TEXT,
        sites TEXT,
        saby_contract_id TEXT,
        saby_contract_number TEXT,
        saby_contract_title TEXT,
        contract_start_date TEXT,
        contract_end_date TEXT,
        contract_status TEXT DEFAULT 'active',
        monthly_fee REAL DEFAULT 15000,
        billing_day INTEGER DEFAULT 1,
        payment_status TEXT DEFAULT 'paid',
        last_payment_date TEXT,
        last_invoice_sent TEXT,
        last_act_sent TEXT,
        client_since TEXT,
        plan_hours REAL DEFAULT 15,
        hours_used REAL DEFAULT 0,
        tariff TEXT,
        sla_target REAL DEFAULT 99.5,
        sla_actual REAL DEFAULT 99.8,
        avg_reaction_time TEXT DEFAULT '15 мин',
        avg_resolution_time TEXT DEFAULT '2 ч 00 мин',
        report_schedule TEXT DEFAULT 'monthly',
        report_sections TEXT DEFAULT 'backups,host_events,mailboxes,account,certs',
        report_start_day INTEGER DEFAULT 1,
        is_archived INTEGER DEFAULT 0,
        archived_at TEXT,
        archived_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS client_credentials (
        client_id INTEGER PRIMARY KEY,
        hosting_provider TEXT DEFAULT 'Beget',
        hosting_url TEXT DEFAULT 'https://cp.beget.com',
        hosting_login TEXT,
        hosting_password TEXT,
        hosting_api_key TEXT,
        bitrix_admin_url TEXT,
        bitrix_login TEXT,
        bitrix_password TEXT,
        bitrix_version TEXT DEFAULT '23.850.0',
        php_version TEXT DEFAULT 'PHP 8.2',
        ssh_host TEXT,
        ssh_port INTEGER DEFAULT 22,
        ssh_user TEXT,
        ssh_password TEXT,
        ssh_key TEXT,
        web_root_dir TEXT,
        backup_token TEXT,
        ftp_host TEXT,
        ftp_port INTEGER DEFAULT 21,
        ftp_user TEXT,
        ftp_password TEXT,
        mysql_host TEXT DEFAULT 'localhost',
        mysql_name TEXT,
        mysql_user TEXT,
        mysql_password TEXT,
        notes TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS client_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        position TEXT,
        email TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'staff',
        token TEXT UNIQUE,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS work_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        hours REAL NOT NULL,
        work_date TEXT NOT NULL,
        category TEXT DEFAULT 'development',
        saby_synced INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        site_name TEXT NOT NULL,
        site_domain TEXT NOT NULL,
        backup_date TEXT NOT NULL,
        size_mb REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'Успешно',
        source TEXT DEFAULT 'Beget AutoBackup',
        created_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS host_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        event_time INTEGER NOT NULL,
        source TEXT NOT NULL,
        event_type TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS saby_docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        doc_id TEXT,
        doc_number TEXT,
        title TEXT,
        date TEXT,
        amount REAL DEFAULT 0,
        status TEXT DEFAULT 'Подписан',
        saby_state TEXT DEFAULT 'synced',
        created_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        contact_id INTEGER,
        contact_name TEXT,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        priority TEXT DEFAULT 'normal',
        status TEXT DEFAULT 'open',
        created_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS verification_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_email TEXT NOT NULL,
        target_type TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS billing_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        amount REAL,
        recipient_email TEXT,
        details TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

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

    `);
  }

  hashPassword(password, salt = null) {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, s, 10000, 64, 'sha512').toString('hex');
    return { hash, salt: s };
  }

  verifyPasswordHash(password, storedHash, salt) {
    if (!salt) {
      // Legacy sha256 compatibility
      const legacy = crypto.createHash('sha256').update(password).digest('hex');
      return legacy === storedHash;
    }
    const check = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return check === storedHash;
  }

  
  resetDatabase() {
    this.db.exec(`
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
    `);
  }

  ensureAdminUser() {
    const row = this.db.prepare('SELECT * FROM admin_users WHERE username = ? OR email = ?').get('admin', 'EKlimov84@gmail.com');
    if (!row) {
      const { hash, salt } = this.hashPassword('admin123');
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO admin_users (username, email, password_hash, salt, two_factor_enabled, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
      `).run('admin', 'EKlimov84@gmail.com', hash, salt, now);
    }
  }

  getAdminUser() {
    return this.db.prepare('SELECT id, username, email, two_factor_enabled, created_at, last_login_at FROM admin_users LIMIT 1').get() || null;
  }

  verifyAdminCredentials(login, password) {
    const row = this.db.prepare('SELECT * FROM admin_users WHERE username = ? OR email = ?').get(login.trim(), login.trim());
    if (!row) return null;
    const ok = this.verifyPasswordHash(password, row.password_hash, row.salt);
    if (!ok) return null;
    return row;
  }

  changeAdminPassword(newPassword) {
    const admin = this.getAdminUser();
    if (!admin) return false;
    const { hash, salt } = this.hashPassword(newPassword);
    this.db.prepare('UPDATE admin_users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, admin.id);
    return true;
  }

  setAdminLastLogin(adminId) {
    this.db.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), adminId);
  }

  // --- 2FA Verification Codes ---
  createVerificationCode(email, type = 'portal') {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
    const now = new Date().toISOString();

    // Expire old unused codes for this email
    this.db.prepare('UPDATE verification_codes SET used = 1 WHERE target_email = ? AND target_type = ?').run(email, type);

    this.db.prepare(`
      INSERT INTO verification_codes (target_email, target_type, code, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(email, type, code, expiresAt, now);

    return { code, expiresAt };
  }

  verifyCode(email, code, type = 'portal') {
    const row = this.db.prepare(`
      SELECT * FROM verification_codes
      WHERE target_email = ? AND target_type = ? AND code = ? AND used = 0
      ORDER BY id DESC LIMIT 1
    `).get(email, type, String(code).trim());

    if (!row) return false;
    if (Date.now() > row.expires_at) {
      return false;
    }

    this.db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(row.id);
    return true;
  }

  // --- JSON Migration ---
  migrateFromJsonIfNeeded() {
    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM clients').get();
    if (countRow && countRow.count > 0) {
      return; // Already populated
    }

    if (!fs.existsSync(JSON_BACKUP_PATH)) {
      return;
    }

    try {
      const raw = fs.readFileSync(JSON_BACKUP_PATH, 'utf8');
      const data = JSON.parse(raw);
      if (!data.clients || !Array.isArray(data.clients) || data.clients.length === 0) {
        return;
      }

      console.log(`[SQLite] Начало переноса ${data.clients.length} клиентов из JSON в защищенную БД SQLite...`);
      const now = new Date().toISOString();

      for (const c of data.clients) {
        const insertClient = this.db.prepare(`
          INSERT INTO clients (
            id, inn, company_name, emails, email_reports, sites,
            saby_contract_id, saby_contract_number, saby_contract_title,
            client_since, plan_hours, hours_used, sla_target, sla_actual,
            avg_reaction_time, avg_resolution_time, report_schedule,
            report_sections, report_start_day, is_archived, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `);

        insertClient.run(
          c.id,
          c.inn || '',
          c.company_name || 'Организация',
          c.emails || '',
          c.email_reports || c.emails || '',
          c.sites || '',
          c.saby_contract_id || '',
          c.saby_contract_number || '',
          c.saby_contract_title || 'Договор комплексного технического сопровождения',
          c.client_since || '2024',
          c.plan_hours || 15,
          c.hours_used || 0,
          c.sla_target || 99.5,
          c.sla_actual || 99.8,
          c.avg_reaction_time || '15 мин',
          c.avg_resolution_time || '2 ч 00 мин',
          c.report_schedule || 'monthly',
          c.report_sections || 'backups,host_events,account,certs',
          c.report_start_day || 1,
          now,
          now
        );

        // Credentials
        const creds = c.credentials || {};
        const insertCreds = this.db.prepare(`
          INSERT INTO client_credentials (
            client_id, hosting_provider, hosting_url, hosting_login, hosting_password, hosting_api_key,
            bitrix_admin_url, bitrix_login, bitrix_password, bitrix_version, php_version,
            ssh_host, ssh_port, ssh_user, ssh_password, ssh_key, web_root_dir, backup_token,
            ftp_host, ftp_port, ftp_user, ftp_password, mysql_host, mysql_name, mysql_user, mysql_password,
            notes, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertCreds.run(
          c.id,
          creds.hosting_provider || 'Beget',
          creds.hosting_url || 'https://cp.beget.com',
          creds.hosting_login || c.beget_login || '',
          creds.hosting_password || c.beget_password || '',
          creds.hosting_api_key || c.beget_api_key || '',
          creds.bitrix_admin_url || (c.sites ? `https://${c.sites.split(',')[0].trim()}/bitrix/admin/` : ''),
          creds.bitrix_login || 'admin',
          creds.bitrix_password || '',
          creds.bitrix_version || '23.850.0',
          creds.php_version || 'PHP 8.2',
          creds.ssh_host || (c.sites ? c.sites.split(',')[0].trim() : ''),
          creds.ssh_port || 22,
          creds.ssh_user || c.beget_login || 'root',
          creds.ssh_password || c.beget_password || '',
          creds.ssh_key || '',
          creds.web_root_dir || (c.sites ? `/var/www/${c.sites.split(',')[0].trim()}/public_html` : '/var/www/html'),
          creds.backup_token || `bkp_${crypto.randomBytes(8).toString('hex')}`,
          creds.ftp_host || '',
          creds.ftp_port || 21,
          creds.ftp_user || '',
          creds.ftp_password || '',
          creds.mysql_host || 'localhost',
          creds.mysql_name || '',
          creds.mysql_user || '',
          creds.mysql_password || '',
          creds.notes || '',
          now
        );
      }

      // Work logs
      if (Array.isArray(data.workLogs)) {
        for (const w of data.workLogs) {
          this.db.prepare(`
            INSERT INTO work_logs (id, client_id, description, hours, work_date, category, saby_synced, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(w.id, w.client_id, w.description, w.hours, w.work_date, w.category || 'development', 1, now);
        }
      }

      // Backups
      if (Array.isArray(data.backups)) {
        for (const b of data.backups) {
          this.db.prepare(`
            INSERT INTO backups (id, client_id, site_name, site_domain, backup_date, size_mb, status, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            b.id,
            b.client_id,
            b.site_name || '',
            b.site_domain || b.site_name || '',
            b.backup_date || now,
            parseFloat(b.size_mb) || 0,
            b.status || 'Успешно',
            b.source || 'Beget AutoBackup',
            now
          );
        }
      }

      // Contacts
      if (Array.isArray(data.contacts)) {
        for (const ct of data.contacts) {
          this.db.prepare(`
            INSERT INTO client_contacts (id, client_id, name, position, email, phone, role, token, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
          `).run(
            ct.id,
            ct.client_id,
            ct.name || 'Контакт',
            ct.position || '',
            ct.email || '',
            ct.phone || '',
            ct.role || 'staff',
            ct.token || crypto.randomBytes(16).toString('hex'),
            now
          );
        }
      }

      // Host Events
      if (Array.isArray(data.hostEvents)) {
        for (const h of data.hostEvents) {
          const detailsStr = typeof h.details === 'string' ? h.details : JSON.stringify(h.details || {});
          this.db.prepare(`
            INSERT INTO host_events (id, client_id, event_time, source, event_type, details_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            h.id,
            h.client_id,
            parseInt(h.event_time, 10) || Math.floor(Date.now() / 1000),
            h.source || 'beget_api',
            h.event_type || 'snapshot',
            detailsStr,
            now
          );
        }
      }

      console.log('[SQLite] ✓ Перенос данных из JSON в SQLite завершен успешно!');
    } catch (err) {
      console.error('[SQLite] Ошибка миграции из JSON:', err);
    }
  }

  // --- Clients CRUD & Soft Delete ---
  getClients(filter = 'active') {
    let sql = 'SELECT * FROM clients';
    if (filter === 'active') {
      sql += ' WHERE is_archived = 0';
    } else if (filter === 'archived') {
      sql += ' WHERE is_archived = 1';
    }
    sql += ' ORDER BY id ASC';
    const rows = this.db.prepare(sql).all();

    // Attach credentials
    return rows.map(r => this.hydrateClient(r));
  }

  getClientById(id, includeArchived = true) {
    const cid = parseInt(id, 10);
    if (isNaN(cid)) return null;
    let sql = 'SELECT * FROM clients WHERE id = ?';
    if (!includeArchived) {
      sql += ' AND is_archived = 0';
    }
    const row = this.db.prepare(sql).get(cid);
    if (!row) return null;
    return this.hydrateClient(row);
  }

  hydrateClient(clientRow) {
    const creds = this.db.prepare('SELECT * FROM client_credentials WHERE client_id = ?').get(clientRow.id) || {};
    return {
      ...clientRow,
      beget_login: creds.hosting_login || '',
      beget_password: creds.hosting_password || '',
      beget_api_key: creds.hosting_api_key || '',
      credentials: creds
    };
  }

  addClient({ inn, company_name, email_reports, sites, saby_contract_id, saby_contract_number, monthly_fee, contract_start_date, contract_end_date }) {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO clients (
        inn, company_name, emails, email_reports, sites,
        saby_contract_id, saby_contract_number, saby_contract_title,
        monthly_fee, contract_start_date, contract_end_date, contract_status, payment_status,
        client_since, plan_hours, hours_used, sla_target, sla_actual,
        avg_reaction_time, avg_resolution_time, report_schedule,
        report_sections, report_start_day, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Договор комплексного технического сопровождения', ?, ?, ?, 'active', 'paid', ?, 15, 0, 99.5, 99.8, '15 мин', '2 ч 00 мин', 'monthly', 'backups,host_events,account,certs', 1, 0, ?, ?)
    `).run(
      (inn || '').trim(),
      (company_name || 'Новая организация').trim(),
      (email_reports || '').trim(),
      (email_reports || '').trim(),
      (sites || '').trim(),
      (saby_contract_id || '').trim(),
      (saby_contract_number || '').trim(),
      parseFloat(monthly_fee) || 15000,
      contract_start_date || now.slice(0, 10),
      contract_end_date || '',
      new Date().getFullYear().toString(),
      now,
      now
    );

    const clientId = Number(result.lastInsertRowid);
    const backupToken = `bkp_${crypto.randomBytes(8).toString('hex')}`;

    this.db.prepare(`
      INSERT INTO client_credentials (client_id, backup_token, updated_at)
      VALUES (?, ?, ?)
    `).run(clientId, backupToken, now);

    return this.getClientById(clientId);
  }

  updateClientFull(id, data) {
    const client = this.getClientById(id);
    if (!client) return null;
    const now = new Date().toISOString();

    const isSecretMasked = (val) => !val || typeof val !== 'string' || val.includes('•') || val.includes('●') || val.includes('***') || val.includes('…');

    const fields = [];
    const values = [];

    const addField = (col, val) => {
      fields.push(`${col} = ?`);
      values.push(val);
    };

    if (data.company_name !== undefined) addField('company_name', data.company_name.trim());
    if (data.inn !== undefined) addField('inn', data.inn.trim());
    if (data.kpp !== undefined) addField('kpp', data.kpp.trim());
    if (data.ogrn !== undefined) addField('ogrn', data.ogrn.trim());
    if (data.director !== undefined) addField('director', data.director.trim());
    if (data.address !== undefined) addField('address', data.address.trim());
    if (data.saby_contract_id !== undefined) addField('saby_contract_id', data.saby_contract_id.trim());
    if (data.saby_contract_number !== undefined) addField('saby_contract_number', data.saby_contract_number.trim());
    if (data.saby_contract_title !== undefined) addField('saby_contract_title', data.saby_contract_title.trim());
    if (data.contract_start_date !== undefined) addField('contract_start_date', data.contract_start_date.trim());
    if (data.contract_end_date !== undefined) addField('contract_end_date', data.contract_end_date.trim());
    if (data.contract_status !== undefined) addField('contract_status', data.contract_status.trim());
    if (data.monthly_fee !== undefined) addField('monthly_fee', parseFloat(data.monthly_fee) || 0);
    if (data.billing_day !== undefined) addField('billing_day', parseInt(data.billing_day, 10) || 1);
    if (data.payment_status !== undefined) addField('payment_status', data.payment_status.trim());
    if (data.plan_hours !== undefined) addField('plan_hours', parseFloat(data.plan_hours) || 15);
    if (data.tariff !== undefined) addField('tariff', data.tariff.trim());
    if (data.sites !== undefined) addField('sites', data.sites.trim());
    if (data.emails !== undefined) {
      addField('emails', data.emails.trim());
      addField('email_reports', data.emails.trim());
    }
    if (data.sla_target !== undefined) addField('sla_target', parseFloat(data.sla_target) || 99.5);
    if (data.report_schedule !== undefined) addField('report_schedule', data.report_schedule);
    if (data.report_sections !== undefined) addField('report_sections', data.report_sections);
    if (data.report_start_day !== undefined) addField('report_start_day', parseInt(data.report_start_day, 10) || 1);

    addField('updated_at', now);

    if (fields.length > 0) {
      values.push(client.id);
      this.db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    // Credentials update
    const currentCreds = client.credentials || {};
    const credFields = [];
    const credValues = [];

    const addCred = (col, val) => {
      credFields.push(`${col} = ?`);
      credValues.push(val);
    };

    if (data.hosting_provider !== undefined) addCred('hosting_provider', data.hosting_provider.trim());
    if (data.hosting_url !== undefined) addCred('hosting_url', data.hosting_url.trim());
    if (data.hosting_login !== undefined) addCred('hosting_login', data.hosting_login.trim());
    if (data.beget_login !== undefined) addCred('hosting_login', data.beget_login.trim());

    if (data.hosting_password !== undefined && !isSecretMasked(data.hosting_password)) {
      addCred('hosting_password', data.hosting_password.trim());
    } else if (data.beget_password !== undefined && !isSecretMasked(data.beget_password)) {
      addCred('hosting_password', data.beget_password.trim());
    }

    if (data.hosting_api_key !== undefined && !isSecretMasked(data.hosting_api_key)) {
      addCred('hosting_api_key', data.hosting_api_key.trim());
    } else if (data.beget_api_key !== undefined && !isSecretMasked(data.beget_api_key)) {
      addCred('hosting_api_key', data.beget_api_key.trim());
    }

    if (data.bitrix_admin_url !== undefined) addCred('bitrix_admin_url', data.bitrix_admin_url.trim());
    if (data.bitrix_login !== undefined) addCred('bitrix_login', data.bitrix_login.trim());
    if (data.bitrix_password !== undefined && !isSecretMasked(data.bitrix_password)) {
      addCred('bitrix_password', data.bitrix_password.trim());
    }
    if (data.bitrix_version !== undefined) addCred('bitrix_version', data.bitrix_version.trim());
    if (data.php_version !== undefined) addCred('php_version', data.php_version.trim());

    if (data.ssh_host !== undefined) addCred('ssh_host', data.ssh_host.trim());
    if (data.ssh_port !== undefined) addCred('ssh_port', parseInt(data.ssh_port, 10) || 22);
    if (data.ssh_user !== undefined) addCred('ssh_user', data.ssh_user.trim());
    if (data.ssh_password !== undefined && !isSecretMasked(data.ssh_password)) {
      addCred('ssh_password', data.ssh_password.trim());
    }
    if (data.ssh_key !== undefined && !isSecretMasked(data.ssh_key)) {
      addCred('ssh_key', data.ssh_key.trim());
    }

    if (data.web_root_dir !== undefined) addCred('web_root_dir', data.web_root_dir.trim());
    if (data.ftp_host !== undefined) addCred('ftp_host', data.ftp_host.trim());
    if (data.ftp_port !== undefined) addCred('ftp_port', parseInt(data.ftp_port, 10) || 21);
    if (data.ftp_user !== undefined) addCred('ftp_user', data.ftp_user.trim());
    if (data.ftp_password !== undefined && !isSecretMasked(data.ftp_password)) {
      addCred('ftp_password', data.ftp_password.trim());
    }

    if (data.mysql_host !== undefined) addCred('mysql_host', data.mysql_host.trim());
    if (data.mysql_name !== undefined) addCred('mysql_name', data.mysql_name.trim());
    if (data.mysql_user !== undefined) addCred('mysql_user', data.mysql_user.trim());
    if (data.mysql_password !== undefined && !isSecretMasked(data.mysql_password)) {
      addCred('mysql_password', data.mysql_password.trim());
    }
    if (data.notes !== undefined) addCred('notes', data.notes.trim());

    addCred('updated_at', now);

    if (credFields.length > 0) {
      credValues.push(client.id);
      this.db.prepare(`UPDATE client_credentials SET ${credFields.join(', ')} WHERE client_id = ?`).run(...credValues);
    }

    return this.getClientById(client.id);
  }

  // --- Soft Delete / Archiving (Forever preserving court data) ---
  archiveClient(id, reason = 'Договор завершен') {
    const cid = parseInt(id, 10);
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE clients
      SET is_archived = 1, archived_at = ?, archived_reason = ?, contract_status = 'ended', updated_at = ?
      WHERE id = ?
    `).run(now, reason, now, cid);

    return this.getClientById(cid, true);
  }

  restoreClient(id) {
    const cid = parseInt(id, 10);
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE clients
      SET is_archived = 0, archived_at = NULL, archived_reason = NULL, contract_status = 'active', updated_at = ?
      WHERE id = ?
    `).run(now, cid);

    return this.getClientById(cid);
  }

  // Soft delete wrapper for safety
  deleteClient(id) {
    return this.archiveClient(id, 'Удален из активного списка CRM (архив для отчетности и суда сохранен)');
  }

  // --- Billing & Payment Control ---
  recordPayment(clientId, amount, paymentDate = null) {
    const cid = parseInt(clientId, 10);
    const pDate = paymentDate || new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE clients
      SET payment_status = 'paid', last_payment_date = ?, updated_at = ?
      WHERE id = ?
    `).run(pDate, now, cid);

    this.db.prepare(`
      INSERT INTO billing_events (client_id, event_type, amount, details, created_at)
      VALUES (?, 'payment_received', ?, ?, ?)
    `).run(cid, parseFloat(amount) || 0, `Оплата зафиксирована: ${pDate}`, now);

    return this.getClientById(cid);
  }

  recordInvoiceSent(clientId, recipientEmail, amount) {
    const cid = parseInt(clientId, 10);
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE clients
      SET payment_status = 'pending', last_invoice_sent = ?, updated_at = ?
      WHERE id = ?
    `).run(now.slice(0, 10), now, cid);

    this.db.prepare(`
      INSERT INTO billing_events (client_id, event_type, amount, recipient_email, details, created_at)
      VALUES (?, 'invoice_sent', ?, ?, ?, ?)
    `).run(cid, parseFloat(amount) || 0, recipientEmail, `Счет отправлен на ${recipientEmail}`, now);

    return this.getClientById(cid);
  }

  recordActSent(clientId, recipientEmail, docNumber) {
    const cid = parseInt(clientId, 10);
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE clients
      SET last_act_sent = ?, updated_at = ?
      WHERE id = ?
    `).run(now.slice(0, 10), now, cid);

    this.db.prepare(`
      INSERT INTO billing_events (client_id, event_type, recipient_email, details, created_at)
      VALUES (?, 'act_sent', ?, ?, ?)
    `).run(cid, recipientEmail, `Акт ${docNumber || ''} отправлен на ${recipientEmail}`, now);

    return this.getClientById(cid);
  }

  getBillingEvents(clientId) {
    return this.db.prepare('SELECT * FROM billing_events WHERE client_id = ? ORDER BY id DESC').all(parseInt(clientId, 10));
  }

  // --- Work Logs ---
  getWorkLogs(clientId) {
    return this.db.prepare('SELECT * FROM work_logs WHERE client_id = ? ORDER BY work_date DESC, id DESC').all(parseInt(clientId, 10));
  }

  addWorkLog(clientId, { description, hours, dateStr, category = 'development' }) {
    const now = new Date().toISOString();
    const wDate = dateStr || now.replace('T', ' ').slice(0, 19);
    const res = this.db.prepare(`
      INSERT INTO work_logs (client_id, description, hours, work_date, category, saby_synced, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(parseInt(clientId, 10), (description || '').trim(), parseFloat(hours) || 0, wDate, category, now);

    // Update client used hours
    this.recalculateClientHours(clientId);
    return res.lastInsertRowid;
  }

  updateWorkLog(logId, { description, hours, dateStr }) {
    const log = this.db.prepare('SELECT * FROM work_logs WHERE id = ?').get(parseInt(logId, 10));
    if (!log) return false;
    this.db.prepare(`
      UPDATE work_logs
      SET description = ?, hours = ?, work_date = ?
      WHERE id = ?
    `).run(description.trim(), parseFloat(hours) || log.hours, dateStr || log.work_date, log.id);

    this.recalculateClientHours(log.client_id);
    return true;
  }

  deleteWorkLog(logId) {
    const log = this.db.prepare('SELECT * FROM work_logs WHERE id = ?').get(parseInt(logId, 10));
    if (!log) return false;
    this.db.prepare('DELETE FROM work_logs WHERE id = ?').run(log.id);
    this.recalculateClientHours(log.client_id);
    return true;
  }

  recalculateClientHours(clientId) {
    const cid = parseInt(clientId, 10);
    const sumRow = this.db.prepare('SELECT SUM(hours) as total FROM work_logs WHERE client_id = ?').get(cid);
    const total = sumRow && sumRow.total ? parseFloat(sumRow.total) : 0;
    this.db.prepare('UPDATE clients SET hours_used = ? WHERE id = ?').run(total, cid);
  }

  // --- Backups ---
  getBackups(clientId, dateFrom = null, dateTo = null) {
    let sql = 'SELECT * FROM backups WHERE client_id = ?';
    const params = [parseInt(clientId, 10)];
    if (dateFrom) {
      sql += ' AND backup_date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND backup_date <= ?';
      params.push(dateTo);
    }
    sql += ' ORDER BY backup_date DESC, id DESC';
    return this.db.prepare(sql).all(...params);
  }

  recordSiteBackup({ client_id, site_name, site_domain, size_mb, status = 'Успешно', source = 'Beget AutoBackup' }) {
    const now = new Date();
    const backupDate = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 8);
    const res = this.db.prepare(`
      INSERT INTO backups (client_id, site_name, site_domain, backup_date, size_mb, status, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(parseInt(client_id, 10), site_name, site_domain || site_name, backupDate, parseFloat(size_mb) || 0, status, source, now.toISOString());
    return { id: res.lastInsertRowid, backup_date: backupDate, status };
  }

  // --- Contacts & Tokens ---
  getContacts(clientId) {
    return this.db.prepare('SELECT * FROM client_contacts WHERE client_id = ? AND is_active = 1 ORDER BY id ASC').all(parseInt(clientId, 10));
  }

  getContactById(id) {
    return this.db.prepare('SELECT * FROM client_contacts WHERE id = ?').get(parseInt(id, 10)) || null;
  }

  getContactByToken(token) {
    if (!token) return null;
    return this.db.prepare('SELECT * FROM client_contacts WHERE token = ? AND is_active = 1').get(token.trim()) || null;
  }

  getContactByEmail(email) {
    if (!email) return null;
    return this.db.prepare('SELECT * FROM client_contacts WHERE LOWER(email) = LOWER(?) AND is_active = 1 LIMIT 1').get(email.trim()) || null;
  }

  addContact(clientId, { name, position, email, phone, role }) {
    const now = new Date().toISOString();
    const token = crypto.randomBytes(16).toString('hex');
    const res = this.db.prepare(`
      INSERT INTO client_contacts (client_id, name, position, email, phone, role, token, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(parseInt(clientId, 10), name.trim(), (position || '').trim(), email.trim(), (phone || '').trim(), role || 'staff', token, now);
    return this.getContactById(res.lastInsertRowid);
  }

  deleteContact(id) {
    this.db.prepare('UPDATE client_contacts SET is_active = 0 WHERE id = ?').run(parseInt(id, 10));
    return true;
  }

  reissueContactToken(id) {
    const token = crypto.randomBytes(16).toString('hex');
    this.db.prepare('UPDATE client_contacts SET token = ? WHERE id = ?').run(token, parseInt(id, 10));
    return this.getContactById(id);
  }

  getClientByToken(token) {
    const contact = this.getContactByToken(token);
    if (!contact) return null;
    return this.getClientById(contact.client_id, true);
  }

  createAccessLink(clientId) {
    const contacts = this.getContacts(clientId);
    let token = '';
    if (contacts.length > 0) {
      token = contacts[0].token;
    } else {
      const newContact = this.addContact(clientId, {
        name: 'Ответственное лицо',
        position: 'Руководитель',
        email: 'client@example.com',
        phone: '',
        role: 'director'
      });
      token = newContact.token;
    }
    return { token, url: `/portal?token=${token}` };
  }

  verifyLoginCode(contactId, inputCode) {
    const cId = parseInt(contactId, 10);
    const contact = this.getContactById(cId);
    if (!contact) return { ok: false, error: 'Контакт не найден' };

    const cleaned = String(inputCode || '').replace(/\s+/g, '').trim();
    if (!cleaned || cleaned.length !== 6) {
      return { ok: false, error: 'Введите корректный 6-значный код подтверждения' };
    }

    const row = this.db.prepare(`
      SELECT * FROM verification_codes
      WHERE target_email = ? AND target_type = 'portal' AND code = ? AND used = 0
      ORDER BY id DESC LIMIT 1
    `).get(contact.email, cleaned);

    if (!row || Date.now() > row.expires_at) {
      return { ok: false, error: 'Неверный или просроченный проверочный код. Запросите новый код.' };
    }

    this.db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(row.id);
    return { ok: true, contact };
  }

  updateClientCredentials(id, data) {
    return this.updateClientFull(id, data);
  }

  updateClientBeget(id, data) {
    return this.updateClientFull(id, {
      beget_login: data.beget_login,
      beget_password: data.beget_pass || data.beget_password,
      beget_api_key: data.beget_api_key,
      sites: data.sites,
      emails: data.emails,
      report_schedule: data.report_schedule,
      report_sections: data.report_sections,
      report_start_day: data.report_start_day
    });
  }

  // --- Saby Docs ---
  getSabyDocs(clientId) {
    return this.db.prepare('SELECT * FROM saby_docs WHERE client_id = ? ORDER BY date DESC, id DESC').all(parseInt(clientId, 10));
  }

  addSabyDoc(clientId, { doc_id, doc_number, title, date, amount, status = 'Подписан' }) {
    const now = new Date().toISOString();
    const res = this.db.prepare(`
      INSERT INTO saby_docs (client_id, doc_id, doc_number, title, date, amount, status, saby_state, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?)
    `).run(parseInt(clientId, 10), doc_id, doc_number, title, date || now.slice(0, 10), parseFloat(amount) || 0, status, now);
    return res.lastInsertRowid;
  }

  createSabyAct(clientId, { monthName, amount }) {
    const now = new Date().toISOString();
    const actNumber = `АКТ-${Math.floor(100 + Math.random() * 900)}/${new Date().getFullYear()}`;
    const res = this.db.prepare(`
      INSERT INTO saby_docs (client_id, doc_id, doc_number, title, date, amount, status, saby_state, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Отправлен в СБИС', 'pending', ?)
    `).run(parseInt(clientId, 10), `saby_${Date.now()}`, actNumber, `Акт выполненных работ (${monthName || 'текущий месяц'})`, now.slice(0, 10), parseFloat(amount) || 0, now);
    return { id: res.lastInsertRowid, actNumber, title: `Акт выполненных работ (${monthName})`, amount };
  }

  // --- Host Events ---
  getHostEvents(clientId) {
    const rows = this.db.prepare('SELECT * FROM host_events WHERE client_id = ? ORDER BY event_time DESC, id DESC').all(parseInt(clientId, 10));
    return rows.map(r => {
      let parsed = {};
      try {
        parsed = JSON.parse(r.details_json);
      } catch (e) {
        parsed = { text: r.details_json };
      }
      return { ...r, details: parsed };
    });
  }

  addHostEvent(clientId, { event_time, source, event_type, details }) {
    const now = new Date().toISOString();
    const timeSec = event_time || Math.floor(Date.now() / 1000);
    const jsonStr = typeof details === 'string' ? details : JSON.stringify(details);
    this.db.prepare(`
      INSERT INTO host_events (client_id, event_time, source, event_type, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(parseInt(clientId, 10), timeSec, source || 'beget_api', event_type || 'snapshot', jsonStr, now);
  }

  getLastSnapshot(clientId) {
    const row = this.db.prepare(`
      SELECT * FROM host_events
      WHERE client_id = ? AND event_type = 'beget_snapshot'
      ORDER BY event_time DESC, id DESC LIMIT 1
    `).get(parseInt(clientId, 10));

    if (!row) return null;
    try {
      return JSON.parse(row.details_json);
    } catch {
      return null;
    }
  }

  // --- Tickets ---
  createTicket(clientId, { contact_id, contact_name, subject, message, priority }) {
    const now = new Date().toISOString();
    const res = this.db.prepare(`
      INSERT INTO tickets (client_id, contact_id, contact_name, subject, message, priority, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
    `).run(parseInt(clientId, 10), contact_id || null, contact_name || 'Клиент', subject, message, priority || 'normal', now);
    return { id: res.lastInsertRowid, subject, status: 'open' };
  }

  // --- Client Dossier Generator (for Court / Legal disputes) ---
  generateCourtDossier(clientId) {
    const client = this.getClientById(clientId, true);
    if (!client) return null;

    const workLogs = this.getWorkLogs(client.id);
    const backups = this.getBackups(client.id);
    const contacts = this.getContacts(client.id);
    const sabyDocs = this.getSabyDocs(client.id);
    const billingEvents = this.getBillingEvents(client.id);

    const totalHours = workLogs.reduce((acc, w) => acc + (parseFloat(w.hours) || 0), 0);
    const totalBilled = sabyDocs.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);

    const dossierPayload = {
      generatedAt: new Date().toISOString(),
      executor: {
        legalName: 'ИП Климов Евгений Владимирович',
        inn: '500100732259',
        email: 'EKlimov84@gmail.com',
        phone: '+7 (926) 880-99-90',
        site: 'klimov-dev.ru'
      },
      client: {
        id: client.id,
        companyName: client.company_name,
        inn: client.inn,
        kpp: client.kpp,
        ogrn: client.ogrn,
        director: client.director,
        address: client.address,
        sites: client.sites,
        emails: client.emails,
        contractNumber: client.saby_contract_number,
        contractTitle: client.saby_contract_title,
        contractStartDate: client.contract_start_date,
        contractEndDate: client.contract_end_date,
        contractStatus: client.contract_status,
        monthlyFee: client.monthly_fee,
        isArchived: !!client.is_archived,
        archivedAt: client.archived_at,
        archivedReason: client.archived_reason
      },
      financialSummary: {
        totalHoursRendered: totalHours,
        totalInvoicedAmount: totalBilled,
        monthlyRate: client.monthly_fee,
        paymentStatus: client.payment_status,
        lastPaymentDate: client.last_payment_date
      },
      workLogsRegistry: workLogs,
      sabyDocsRegistry: sabyDocs,
      backupsRegistry: backups,
      contactsRegistry: contacts,
      billingEventsRegistry: billingEvents
    };

    // Calculate cryptographic verification checksum of the legal dossier
    const hash = crypto.createHash('sha256').update(JSON.stringify(dossierPayload)).digest('hex');
    dossierPayload.integrityChecksum = hash;

    return dossierPayload;
  }

  // --- Helper Compatibility Methods ---
  
  // --- Hosting & Sites Management ---
  getHostingAccounts(clientId) {
    return this.db.prepare('SELECT * FROM client_hosting_accounts WHERE client_id = ? ORDER BY provider_name').all(clientId);
  }

  addHostingAccount(clientId, data) {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      INSERT INTO client_hosting_accounts (
        client_id, provider_name, provider_url, login, password, api_key, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
    const result = this.db.prepare(`
      INSERT INTO client_sites (
        client_id, hosting_account_id, url, cms_type, cms_login, cms_password, ssh_host, ssh_user, ssh_password, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      clientId, data.hosting_account_id || null, data.url, data.cms_type || '1C-Bitrix', 
      data.cms_login || '', data.cms_password || '', data.ssh_host || '', 
      data.ssh_user || '', data.ssh_password || '', data.notes || '', now, now
    );
    return result.lastInsertRowid;
  }
  
  deleteSite(id) {
    this.db.prepare('DELETE FROM client_sites WHERE id = ?').run(id);
  }

  getClientSites(clientId) {
    const c = this.getClientById(clientId, true);
    if (!c || !c.sites) return [];
    return c.sites.split(',').map(s => s.trim()).filter(Boolean);
  }

  getClientCredentials(clientId, options = { mask: true }) {
    const c = this.getClientById(clientId, true);
    if (!c) return {};
    const creds = c.credentials || {};

    if (!options.mask) return creds;

    const maskSecret = (s) => (s && typeof s === 'string' && s.length > 0 ? '••••••••' : '');
    return {
      ...creds,
      hosting_password: maskSecret(creds.hosting_password),
      bitrix_password: maskSecret(creds.bitrix_password),
      ssh_password: maskSecret(creds.ssh_password),
      ssh_key: maskSecret(creds.ssh_key),
      ftp_password: maskSecret(creds.ftp_password),
      mysql_password: maskSecret(creds.mysql_password)
    };
  }

  getPortalSummary(clientId) {
    const client = this.getClientById(clientId, true);
    if (!client) return {};
    const logs = this.getWorkLogs(clientId);
    const backups = this.getBackups(clientId);
    return {
      plan_hours: client.plan_hours || 15,
      hours_used: client.hours_used || 0,
      sla_target: client.sla_target || 99.5,
      sla_actual: client.sla_actual || 99.8,
      avg_reaction_time: client.avg_reaction_time || '15 мин',
      avg_resolution_time: client.avg_resolution_time || '2 ч 00 мин',
      total_tasks_done: logs.length,
      last_backup_date: backups[0]?.backup_date || 'Не проводился'
    };
  }

  getSabySyncLogs(clientId) {
    return [
      {
        id: 1,
        date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        direction: 'two_way',
        entity: 'Трудозатраты и акты',
        status: 'Успешно',
        details: 'Автоматическая синхронизация регламентных работ с СБИС CRM'
      }
    ];
  }

  getServiceEvents(clientId, category = 'all') {
    const events = this.getHostEvents(clientId);
    if (category === 'all') return events;
    return events.filter(e => e.event_type === category);
  }

  // Legacy password compatibility
  verifyPassword(password) {
    const admin = this.getAdminUser();
    if (!admin) return false;
    return this.verifyAdminCredentials(admin.username, password) !== null;
  }

  changePassword(newPassword) {
    return this.changeAdminPassword(newPassword);
  }

  saveToDisk() {
    // SQLite commits synchronously with WAL mode
    return true;
  }
}

export const sqliteDb = new SqliteDatabase();
