import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SETTINGS_FILE = path.join(__dirname, 'data', 'crm_secure_settings.json');
const SABY_CONFIG_FILE = path.join(__dirname, '.saby_config');

class SettingsManager {
  constructor() {
    this.settings = this.loadSettings();
    this.applyToEnv();
  }

  getDefaultSettings() {
    return {
      // Saby / СБИС
      saby_app_client_id: process.env.SABY_APP_CLIENT_ID || '',
      saby_app_secret: process.env.SABY_APP_SECRET || '',
      saby_secret_key: process.env.SABY_SECRET_KEY || '',
      saby_login: process.env.SABY_LOGIN || '',
      saby_password: process.env.SABY_PASSWORD || '',
      saby_rpc_url: process.env.SABY_RPC_URL || 'https://online.sbis.ru/service/sbis-rpc.service',
      saby_auto_sync: true,
      saby_sync_interval_hours: 6,

      // Beget Cloud
      beget_login: process.env.BEGET_LOGIN || '',
      beget_password: process.env.BEGET_PASSWORD || '',
      beget_api_key: process.env.BEGET_API_KEY || '',

      // Backup monitoring & webhooks
      backup_webhook_secret: process.env.BACKUP_WEBHOOK_SECRET || crypto.randomBytes(16).toString('hex'),
      backup_alert_email: process.env.BACKUP_ALERT_EMAIL || 'EKlimov84@gmail.com',
      backup_retention_days: 30,

      // Corporate Mail / SMTP settings
      smtp_host: process.env.SMTP_HOST || 'smtp.beget.com',
      smtp_port: parseInt(process.env.SMTP_PORT, 10) || 465,
      smtp_secure: process.env.SMTP_SECURE !== 'false',
      smtp_user: process.env.SMTP_USER || 'info@e-klimov.ru',
      smtp_password: process.env.SMTP_PASSWORD || '',
      smtp_from_name: process.env.SMTP_FROM_NAME || 'Евгений Климов | IT-сопровождение',
      smtp_from_email: process.env.SMTP_FROM_EMAIL || 'info@e-klimov.ru',
      admin_notify_email: process.env.ADMIN_NOTIFY_EMAIL || 'EKlimov84@gmail.com',

      // GitHub CI/CD
      github_token: process.env.GITHUB_TOKEN || '',
      github_repo: process.env.GITHUB_REPO || 'EKlimov84/crm-beget-saby',
      github_branch: process.env.GITHUB_BRANCH || 'main',

      // Security metadata
      updated_at: new Date().toISOString()
    };
  }

  loadSettings() {
    try {
      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return { ...this.getDefaultSettings(), ...parsed };
      }
    } catch (e) {
      console.warn('[SettingsManager] Ошибка чтения crm_secure_settings.json:', e.message);
    }

    // Check fallback .saby_config if exists
    const defaults = this.getDefaultSettings();
    if (fs.existsSync(SABY_CONFIG_FILE)) {
      try {
        const rawSaby = fs.readFileSync(SABY_CONFIG_FILE, 'utf8');
        const parsedSaby = JSON.parse(rawSaby);
        if (parsedSaby.app_client_id) defaults.saby_app_client_id = parsedSaby.app_client_id;
        if (parsedSaby.app_secret) defaults.saby_app_secret = parsedSaby.app_secret;
        if (parsedSaby.secret_key) defaults.saby_secret_key = parsedSaby.secret_key;
      } catch (e) {
        // ignore
      }
    }

    return defaults;
  }

  applyToEnv() {
    // Inject active settings into process.env so Saby & Beget clients immediately see them
    if (this.settings.saby_app_client_id) process.env.SABY_APP_CLIENT_ID = this.settings.saby_app_client_id;
    if (this.settings.saby_app_secret) process.env.SABY_APP_SECRET = this.settings.saby_app_secret;
    if (this.settings.saby_secret_key) process.env.SABY_SECRET_KEY = this.settings.saby_secret_key;
    if (this.settings.saby_login) process.env.SABY_LOGIN = this.settings.saby_login;
    if (this.settings.saby_password) process.env.SABY_PASSWORD = this.settings.saby_password;
    if (this.settings.saby_rpc_url) process.env.SABY_RPC_URL = this.settings.saby_rpc_url;

    if (this.settings.beget_login) process.env.BEGET_LOGIN = this.settings.beget_login;
    if (this.settings.beget_password) process.env.BEGET_PASSWORD = this.settings.beget_password;
    if (this.settings.beget_api_key) process.env.BEGET_API_KEY = this.settings.beget_api_key;

    if (this.settings.github_token) process.env.GITHUB_TOKEN = this.settings.github_token;
    if (this.settings.backup_webhook_secret) process.env.BACKUP_WEBHOOK_SECRET = this.settings.backup_webhook_secret;

    if (this.settings.smtp_host) process.env.SMTP_HOST = this.settings.smtp_host;
    if (this.settings.smtp_port) process.env.SMTP_PORT = String(this.settings.smtp_port);
    if (this.settings.smtp_user) process.env.SMTP_USER = this.settings.smtp_user;
    if (this.settings.smtp_password) process.env.SMTP_PASSWORD = this.settings.smtp_password;
    if (this.settings.smtp_from_email) process.env.SMTP_FROM_EMAIL = this.settings.smtp_from_email;
    if (this.settings.smtp_from_name) process.env.SMTP_FROM_NAME = this.settings.smtp_from_name;
    if (this.settings.admin_notify_email) process.env.ADMIN_NOTIFY_EMAIL = this.settings.admin_notify_email;
  }

  saveSettings(newValues) {
    const s = this.settings;

    // Helper to preserve existing secrets if user sent placeholder or empty
    const updateSecret = (key, val) => {
      if (val !== undefined && val !== null) {
        const trimmed = String(val).trim();
        if (trimmed && !trimmed.startsWith('••••') && !trimmed.includes('***')) {
          s[key] = trimmed;
        }
      }
    };

    updateSecret('saby_app_client_id', newValues.saby_app_client_id);
    updateSecret('saby_app_secret', newValues.saby_app_secret);
    updateSecret('saby_secret_key', newValues.saby_secret_key);
    updateSecret('saby_login', newValues.saby_login);
    updateSecret('saby_password', newValues.saby_password);
    if (newValues.saby_rpc_url) s.saby_rpc_url = String(newValues.saby_rpc_url).trim();
    if (newValues.saby_auto_sync !== undefined) s.saby_auto_sync = !!newValues.saby_auto_sync;
    if (newValues.saby_sync_interval_hours !== undefined) s.saby_sync_interval_hours = parseInt(newValues.saby_sync_interval_hours, 10) || 6;

    updateSecret('beget_login', newValues.beget_login);
    updateSecret('beget_password', newValues.beget_password);
    updateSecret('beget_api_key', newValues.beget_api_key);

    updateSecret('github_token', newValues.github_token);
    if (newValues.github_repo) s.github_repo = String(newValues.github_repo).trim();
    if (newValues.github_branch) s.github_branch = String(newValues.github_branch).trim();

    updateSecret('backup_webhook_secret', newValues.backup_webhook_secret);
    if (newValues.backup_alert_email) s.backup_alert_email = String(newValues.backup_alert_email).trim();
    if (newValues.backup_retention_days) s.backup_retention_days = parseInt(newValues.backup_retention_days, 10) || 30;

    // SMTP Mailer
    if (newValues.smtp_host) s.smtp_host = String(newValues.smtp_host).trim();
    if (newValues.smtp_port) s.smtp_port = parseInt(newValues.smtp_port, 10) || 465;
    if (newValues.smtp_secure !== undefined) s.smtp_secure = !!newValues.smtp_secure;
    if (newValues.smtp_user) s.smtp_user = String(newValues.smtp_user).trim();
    updateSecret('smtp_password', newValues.smtp_password);
    if (newValues.smtp_from_name) s.smtp_from_name = String(newValues.smtp_from_name).trim();
    if (newValues.smtp_from_email) s.smtp_from_email = String(newValues.smtp_from_email).trim();
    if (newValues.admin_notify_email) s.admin_notify_email = String(newValues.admin_notify_email).trim();

    s.updated_at = new Date().toISOString();

    // Write file securely with restricted permissions (0600)
    try {
      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), { mode: 0o600 });
      try {
        fs.chmodSync(SETTINGS_FILE, 0o600);
      } catch (e) {
        // ignore on systems where chmod is restricted
      }

      // Sync to .saby_config for legacy python/bash tools
      try {
        const sabyConfig = {
          app_client_id: s.saby_app_client_id,
          app_secret: s.saby_app_secret,
          secret_key: s.saby_secret_key,
          login: s.saby_login,
          password: s.saby_password,
          rpc_url: s.saby_rpc_url
        };
        fs.writeFileSync(SABY_CONFIG_FILE, JSON.stringify(sabyConfig, null, 2), { mode: 0o600 });
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.error('[SettingsManager] Ошибка сохранения настроек:', e.message);
      return { ok: false, error: e.message };
    }

    this.applyToEnv();
    return { ok: true, settings: this.getPublicSettings() };
  }

  getPublicSettings() {
    const mask = (val) => {
      if (!val) return '';
      if (val.length <= 6) return '••••••••';
      return val.slice(0, 3) + '••••••••' + val.slice(-3);
    };

    return {
      saby_app_client_id: this.settings.saby_app_client_id,
      has_saby_client_id: !!this.settings.saby_app_client_id,
      saby_app_secret_masked: mask(this.settings.saby_app_secret),
      has_saby_secret: !!this.settings.saby_app_secret,
      saby_secret_key_masked: mask(this.settings.saby_secret_key),
      has_saby_key: !!this.settings.saby_secret_key,
      saby_login: this.settings.saby_login,
      saby_password_masked: mask(this.settings.saby_password),
      has_saby_password: !!this.settings.saby_password,
      saby_rpc_url: this.settings.saby_rpc_url,
      saby_auto_sync: this.settings.saby_auto_sync,
      saby_sync_interval_hours: this.settings.saby_sync_interval_hours,

      beget_login: this.settings.beget_login,
      has_beget_login: !!this.settings.beget_login,
      beget_password_masked: mask(this.settings.beget_password),
      has_beget_password: !!this.settings.beget_password,
      beget_api_key_masked: mask(this.settings.beget_api_key),
      has_beget_api_key: !!this.settings.beget_api_key,

      backup_webhook_secret: this.settings.backup_webhook_secret,
      backup_alert_email: this.settings.backup_alert_email,
      backup_retention_days: this.settings.backup_retention_days,

      // SMTP Mailer
      smtp_host: this.settings.smtp_host,
      smtp_port: this.settings.smtp_port,
      smtp_secure: this.settings.smtp_secure,
      smtp_user: this.settings.smtp_user,
      has_smtp_password: !!this.settings.smtp_password,
      smtp_password_masked: mask(this.settings.smtp_password),
      smtp_from_name: this.settings.smtp_from_name,
      smtp_from_email: this.settings.smtp_from_email,
      admin_notify_email: this.settings.admin_notify_email,

      github_token_masked: mask(this.settings.github_token),
      has_github_token: !!this.settings.github_token,
      github_repo: this.settings.github_repo,
      github_branch: this.settings.github_branch,

      updated_at: this.settings.updated_at
    };
  }

  getRawSettings() {
    return this.settings;
  }
}

export const settingsManager = new SettingsManager();
