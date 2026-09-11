// In-memory persistent data store for CRM with pre-seeded data
import crypto from 'crypto';

class CrmStore {
  constructor() {
    this.clients = [];
    this.workLogs = [];
    this.backups = [];
    this.hostEvents = [];
    this.accessLinks = [];
    this.adminUser = {
      username: 'admin',
      passwordHash: this.hashPassword('admin123'),
      mustChange: false
    };

    this.seedInitialData();
  }

  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  verifyPassword(password) {
    const inputHash = this.hashPassword(password);
    return inputHash === this.adminUser.passwordHash;
  }

  changePassword(newPassword) {
    this.adminUser.passwordHash = this.hashPassword(newPassword);
    this.adminUser.mustChange = false;
  }

  seedInitialData() {
    // Client 1: ООО "ТехноПром"
    this.clients.push({
      id: 1,
      inn: '7707083893',
      company_name: 'ООО "ТехноПром"',
      emails: 'support@technoprom.ru, director@technoprom.ru',
      email_reports: 'support@technoprom.ru',
      sites: 'technoprom.ru, shop.technoprom.ru',
      saby_contract_id: 'cnt-101',
      saby_contract_number: '24/ИТ-01',
      beget_login: 'technoprom_ru',
      beget_password: '••••••••',
      beget_api_key: 'bg_live_89123847291',
      report_schedule: 'monthly',
      report_sections: 'backups,host_events,mailboxes,account,certs',
      report_start_day: 1
    });

    // Client 2: ООО "Альфа-Сервис"
    this.clients.push({
      id: 2,
      inn: '7801234567',
      company_name: 'ООО "Альфа-Сервис"',
      emails: 'office@alpha-service.pro',
      email_reports: 'office@alpha-service.pro',
      sites: 'alpha-service.pro',
      saby_contract_id: 'cnt-201',
      saby_contract_number: 'АС-2024/05',
      beget_login: 'alphaserv',
      beget_password: '••••••••',
      beget_api_key: '',
      report_schedule: 'weekly',
      report_sections: 'backups,account,certs',
      report_start_day: 5
    });

    // Client 3: ИП Климов Е.В.
    this.clients.push({
      id: 3,
      inn: '500100732259',
      company_name: 'ИП Климов Евгений Владимирович',
      emails: 'EKlimov84@gmail.com',
      email_reports: 'EKlimov84@gmail.com',
      sites: 'klimov-dev.ru, crm.klimov-dev.ru',
      saby_contract_id: 'cnt-301',
      saby_contract_number: 'КЛ-01/24',
      beget_login: 'klimov_beget',
      beget_password: '••••••••',
      beget_api_key: 'bg_klimov_token_2024',
      report_schedule: 'monthly',
      report_sections: 'backups,host_events,mailboxes,account,certs',
      report_start_day: 1
    });

    // Seed Work Logs
    const now = new Date();
    const d1 = new Date(now.getTime() - 2 * 86400000);
    const d2 = new Date(now.getTime() - 5 * 86400000);
    const d3 = new Date(now.getTime() - 12 * 86400000);
    const d4 = new Date(now.getTime() - 18 * 86400000);

    this.workLogs.push(
      {
        id: 1,
        client_id: 1,
        description: 'Плановое обновление ядра 1С-Битрикс до версии 23.850. Проверка контрольной суммы файлов и БД.',
        hours: 2.5,
        work_date: d1.toISOString().replace('T', ' ').slice(0, 19)
      },
      {
        id: 2,
        client_id: 1,
        description: 'Настройка автоматического создания почтовых ящиков @technoprom.ru и проверка SPF/DKIM записей.',
        hours: 1.0,
        work_date: d2.toISOString().replace('T', ' ').slice(0, 19)
      },
      {
        id: 3,
        client_id: 1,
        description: 'Диагностика и оптимизация запросов MySQL в каталоге товаров. Уменьшение времени отклика TTFB до 180ms.',
        hours: 3.0,
        work_date: d3.toISOString().replace('T', ' ').slice(0, 19)
      },
      {
        id: 4,
        client_id: 1,
        description: 'Продление и перевыпуск бесплатного Let\'s Encrypt SSL-сертификата для поддомена shop.technoprom.ru.',
        hours: 0.5,
        work_date: d4.toISOString().replace('T', ' ').slice(0, 19)
      },
      {
        id: 5,
        client_id: 2,
        description: 'Мониторинг дискового пространства Beget, удаление временных логов nginx и кэша сайта.',
        hours: 1.5,
        work_date: d2.toISOString().replace('T', ' ').slice(0, 19)
      },
      {
        id: 6,
        client_id: 3,
        description: 'Развертывание обновленной версии CRM с интеграцией Saby API и автоматической генерацией PDF отчетов.',
        hours: 4.0,
        work_date: d1.toISOString().replace('T', ' ').slice(0, 19)
      }
    );

    // Seed Backups
    this.backups.push(
      {
        id: 1,
        client_id: 1,
        site_name: 'technoprom.ru',
        site_domain: 'technoprom.ru',
        backup_date: new Date(now.getTime() - 1 * 86400000).toISOString().slice(0, 10) + ' 03:15:00',
        size_mb: 2450.8,
        status: 'Успешно',
        source: 'Beget AutoBackup'
      },
      {
        id: 2,
        client_id: 1,
        site_name: 'shop.technoprom.ru (БД MySQL)',
        site_domain: 'shop.technoprom.ru',
        backup_date: new Date(now.getTime() - 1 * 86400000).toISOString().slice(0, 10) + ' 03:45:00',
        size_mb: 382.4,
        status: 'Успешно',
        source: 'Beget MySQL Dump'
      },
      {
        id: 3,
        client_id: 1,
        site_name: '1С-Битрикс Резервная копия (full)',
        site_domain: 'technoprom.ru',
        backup_date: new Date(now.getTime() - 4 * 86400000).toISOString().slice(0, 10) + ' 02:00:00',
        size_mb: 4120.0,
        status: 'Успешно',
        source: 'Bitrix Core Backup'
      },
      {
        id: 4,
        client_id: 2,
        site_name: 'alpha-service.pro',
        site_domain: 'alpha-service.pro',
        backup_date: new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10) + ' 04:00:00',
        size_mb: 890.5,
        status: 'Успешно',
        source: 'Beget AutoBackup'
      },
      {
        id: 5,
        client_id: 3,
        site_name: 'crm.klimov-dev.ru',
        site_domain: 'crm.klimov-dev.ru',
        backup_date: new Date(now.getTime() - 1 * 86400000).toISOString().slice(0, 10) + ' 05:00:00',
        size_mb: 154.2,
        status: 'Успешно',
        source: 'Beget Cloud Backup'
      }
    );

    // Seed Host Events
    const snap1 = {
      account: { user_balance: '3 480.00', plan: 'Noble', disk_used_mb: 12400, disk_total_mb: 25000 },
      snapshot: {
        domains: [
          { fqdn: 'technoprom.ru', ssl_status: 'active', date_expire: '15.04.2025' },
          { fqdn: 'shop.technoprom.ru', ssl_status: 'active', date_expire: '15.04.2025' }
        ]
      }
    };
    this.hostEvents.push({
      id: 1,
      client_id: 1,
      event_time: Math.floor(now.getTime() / 1000) - 3600,
      source: 'beget_api',
      event_type: 'beget_snapshot',
      details: snap1
    });

    const snap2 = {
      account: { user_balance: '1 250.00', plan: 'Start', disk_used_mb: 3200, disk_total_mb: 10000 },
      snapshot: {
        domains: [
          { fqdn: 'alpha-service.pro', ssl_status: 'active', date_expire: '28.11.2024' }
        ]
      }
    };
    this.hostEvents.push({
      id: 2,
      client_id: 2,
      event_time: Math.floor(now.getTime() / 1000) - 7200,
      source: 'beget_api',
      event_type: 'beget_snapshot',
      details: snap2
    });

    const snap3 = {
      account: { user_balance: '4 820.00', plan: 'VIP', disk_used_mb: 4500, disk_total_mb: 50000 },
      snapshot: {
        domains: [
          { fqdn: 'klimov-dev.ru', ssl_status: 'active', date_expire: '10.08.2025' },
          { fqdn: 'crm.klimov-dev.ru', ssl_status: 'active', date_expire: '10.08.2025' }
        ]
      }
    };
    this.hostEvents.push({
      id: 3,
      client_id: 3,
      event_time: Math.floor(now.getTime() / 1000) - 1800,
      source: 'beget_api',
      event_type: 'beget_snapshot',
      details: snap3
    });
  }

  // --- Clients CRUD ---
  getClients() {
    return this.clients;
  }

  getClientById(id) {
    return this.clients.find(c => c.id === parseInt(id, 10)) || null;
  }

  addClient({ inn, company_name, email_reports, sites, saby_contract_id, saby_contract_number }) {
    const nextId = this.clients.length > 0 ? Math.max(...this.clients.map(c => c.id)) + 1 : 1;
    const client = {
      id: nextId,
      inn: (inn || '').trim(),
      company_name: (company_name || 'Новая организация').trim(),
      emails: (email_reports || '').trim(),
      email_reports: (email_reports || '').trim(),
      sites: (sites || '').trim(),
      saby_contract_id: (saby_contract_id || '').trim(),
      saby_contract_number: (saby_contract_number || '').trim(),
      beget_login: '',
      beget_password: '',
      beget_api_key: '',
      report_schedule: 'monthly',
      report_sections: 'backups,host_events,account,certs',
      report_start_day: 1
    };
    this.clients.push(client);
    return client;
  }

  updateClientBeget(id, data) {
    const client = this.getClientById(id);
    if (!client) return null;

    if (data.beget_login !== undefined) client.beget_login = data.beget_login;
    if (data.beget_pass !== undefined) client.beget_password = data.beget_pass;
    if (data.beget_api_key !== undefined) client.beget_api_key = data.beget_api_key;
    if (data.sites !== undefined) client.sites = data.sites;
    if (data.emails !== undefined) {
      client.emails = data.emails;
      client.email_reports = data.emails;
    }
    if (data.report_schedule !== undefined) client.report_schedule = data.report_schedule;
    if (data.report_sections !== undefined) client.report_sections = data.report_sections;
    if (data.report_start_day !== undefined) client.report_start_day = parseInt(data.report_start_day, 10) || 1;

    return client;
  }

  // --- Work Logs ---
  getWorkLogs(clientId) {
    return this.workLogs
      .filter(l => l.client_id === parseInt(clientId, 10))
      .sort((a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime());
  }

  addWorkLog(clientId, description, hours, workDate) {
    const nextId = this.workLogs.length > 0 ? Math.max(...this.workLogs.map(l => l.id)) + 1 : 1;
    let finalDate = workDate;
    if (!finalDate) {
      const now = new Date();
      finalDate = now.toISOString().replace('T', ' ').slice(0, 19);
    }
    const log = {
      id: nextId,
      client_id: parseInt(clientId, 10),
      description: (description || '').trim(),
      hours: parseFloat(hours) || 1.0,
      work_date: finalDate
    };
    this.workLogs.push(log);
    return log;
  }

  updateWorkLog(logId, description, hours, workDate) {
    const log = this.workLogs.find(l => l.id === parseInt(logId, 10));
    if (!log) return null;
    log.description = (description || '').trim();
    log.hours = parseFloat(hours) || 1.0;
    if (workDate) log.work_date = workDate;
    return log;
  }

  deleteWorkLog(logId) {
    const idx = this.workLogs.findIndex(l => l.id === parseInt(logId, 10));
    if (idx !== -1) {
      this.workLogs.splice(idx, 1);
      return true;
    }
    return false;
  }

  // --- Backups & Host Events ---
  getBackups(clientId, dateFrom, dateTo) {
    const cId = parseInt(clientId, 10);
    return this.backups
      .filter(b => {
        if (b.client_id !== cId) return false;
        if (dateFrom && b.backup_date < dateFrom) return false;
        if (dateTo && b.backup_date > dateTo + ' 23:59:59') return false;
        return true;
      })
      .sort((a, b) => new Date(b.backup_date).getTime() - new Date(a.backup_date).getTime());
  }

  getHostEvents(clientId) {
    const cId = parseInt(clientId, 10);
    return this.hostEvents
      .filter(e => e.client_id === cId)
      .sort((a, b) => b.event_time - a.event_time);
  }

  getLastSnapshot(clientId) {
    const events = this.getHostEvents(clientId);
    return events.find(e => e.event_type === 'beget_snapshot') || null;
  }

  // --- Access Links ---
  createAccessLink(clientId) {
    const cId = parseInt(clientId, 10);
    const token = crypto.randomBytes(24).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Revoke previous links
    this.accessLinks.forEach(l => {
      if (l.client_id === cId && !l.revoked_at) {
        l.revoked_at = new Date().toISOString();
      }
    });

    const linkRecord = {
      id: this.accessLinks.length + 1,
      client_id: cId,
      token,
      token_hash: tokenHash,
      created_at: new Date().toISOString(),
      last_used_at: null,
      revoked_at: null
    };
    this.accessLinks.push(linkRecord);
    return token;
  }

  getClientByToken(token) {
    if (!token || token.length < 16) return null;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const link = this.accessLinks.find(l => l.token_hash === tokenHash && !l.revoked_at);
    if (!link) return null;
    link.last_used_at = new Date().toISOString();
    return this.getClientById(link.client_id);
  }
}

export const db = new CrmStore();
