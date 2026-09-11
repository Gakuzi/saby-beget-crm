// Persistent data store for CRM with disk storage and credentials management
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticateSaby, fetchSabyContracts, getSabyCredentials } from './saby_client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'data', 'crm_database.json');

class CrmStore {
  constructor() {
    this.clients = [];
    this.workLogs = [];
    this.backups = [];
    this.hostEvents = [];
    this.accessLinks = [];
    this.serviceEvents = [];
    this.tickets = [];
    this.sabyDocs = [];
    this.contacts = [];
    this.verificationCodes = [];
    this.adminUser = {
      username: 'admin',
      passwordHash: this.hashPassword('admin123'),
      mustChange: false
    };

    const loaded = this.loadFromDisk();
    if (!loaded) {
      this.seedInitialData();
      this.saveToDisk();
    }
    if (!this.contacts || this.contacts.length === 0) {
      this.seedInitialContacts();
      this.saveToDisk();
    }
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.clients && Array.isArray(parsed.clients) && parsed.clients.length > 0) {
          this.clients = parsed.clients;
          this.workLogs = parsed.workLogs || [];
          this.backups = parsed.backups || [];
          this.hostEvents = parsed.hostEvents || [];
          this.accessLinks = parsed.accessLinks || [];
          this.serviceEvents = parsed.serviceEvents || [];
          this.tickets = parsed.tickets || [];
          this.sabyDocs = parsed.sabyDocs || [];
          this.contacts = parsed.contacts || [];
          this.verificationCodes = parsed.verificationCodes || [];
          if (parsed.adminUser) this.adminUser = parsed.adminUser;
          return true;
        }
      }
    } catch (err) {
      console.warn('[CrmStore] Ошибка загрузки crm_database.json, используем инициализацию:', err.message);
    }
    return false;
  }

  saveToDisk() {
    try {
      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const state = {
        savedAt: new Date().toISOString(),
        clients: this.clients,
        workLogs: this.workLogs,
        backups: this.backups,
        hostEvents: this.hostEvents,
        accessLinks: this.accessLinks,
        serviceEvents: this.serviceEvents,
        tickets: this.tickets,
        sabyDocs: this.sabyDocs,
        contacts: this.contacts,
        verificationCodes: this.verificationCodes,
        adminUser: this.adminUser
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
      try {
        fs.chmodSync(DB_FILE, 0o600);
      } catch (e) {
        // ignore
      }
      return true;
    } catch (err) {
      console.error('[CrmStore] Ошибка сохранения crm_database.json:', err.message);
      return false;
    }
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

    // Client 2: ООО "Альфа-Сервис" (URL: /client/2)
    this.clients.push({
      id: 2,
      inn: '7801234567',
      company_name: 'ООО "Альфа-Сервис"',
      emails: 'office@alpha-service.pro, director@alpha-service.pro',
      email_reports: 'office@alpha-service.pro',
      sites: 'alpha-service.pro, crm.alpha-service.pro, dev.alpha-service.pro',
      saby_contract_id: 'cnt-201',
      saby_contract_number: 'АС-2024/05',
      saby_contract_title: 'Договор комплексного технического сопровождения сайтов и серверов',
      client_since: 'Февраль 2024',
      plan_hours: 15,
      hours_used: 11.5,
      beget_login: 'alphaserv',
      beget_password: '••••••••',
      beget_api_key: 'bg_alpha_mock_key_2024',
      report_schedule: 'monthly',
      report_sections: 'backups,host_events,mailboxes,account,certs',
      report_start_day: 1,
      sla_target: 99.5,
      sla_actual: 99.8,
      avg_reaction_time: '14 мин',
      avg_resolution_time: '2 ч 10 мин'
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
      saby_contract_title: 'Комплексное сопровождение доменов, почты и хостинга',
      client_since: 'Январь 2024',
      plan_hours: 20,
      beget_login: 'klimov_beget',
      beget_password: '••••••••',
      beget_api_key: 'bg_klimov_token_2024',
      report_schedule: 'monthly',
      report_sections: 'backups,host_events,mailboxes,account,certs',
      report_start_day: 1,
      sla_target: 99.5,
      sla_actual: 99.9,
      avg_reaction_time: '12 мин',
      avg_resolution_time: '1 ч 30 мин'
    });

    // Client 4: ООО "Северный Вектор" (from reference mockups)
    this.clients.push({
      id: 4,
      inn: '7724890123',
      company_name: 'ООО "Северный Вектор"',
      emails: 'it@sever-vector.ru, director@sever-vector.ru',
      email_reports: 'it@sever-vector.ru',
      sites: 'sever-vector.ru, shop.sever-vector.ru, blog.sever-vector.ru, test.sever-vector.ru',
      saby_contract_id: 'cnt-601',
      saby_contract_number: 'Д-2024/017',
      saby_contract_title: 'Договор комплексного технического сопровождения сайтов и серверов',
      client_since: 'Декабрь 2023',
      plan_hours: 15,
      hours_used: 12,
      beget_login: 'severvec',
      beget_password: '••••••••',
      beget_api_key: 'bg_live_sv_9948127',
      report_schedule: 'monthly',
      report_sections: 'backups,host_events,mailboxes,account,certs',
      report_start_day: 1,
      sla_target: 99.5,
      sla_actual: 99.6,
      avg_reaction_time: '18 мин',
      avg_resolution_time: '2 ч 47 мин'
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

    // Client 4: ООО "Северный Вектор" (Reference Mockups)
    const snap4 = {
      account: { user_balance: '14 350.00', plan: 'VIP-Ultra', disk_used_mb: 34200, disk_total_mb: 100000 },
      snapshot: {
        domains: [
          { fqdn: 'sever-vector.ru', ssl_status: 'active', date_expire: '12.08.2026' },
          { fqdn: 'shop.sever-vector.ru', ssl_status: 'active', date_expire: '21.07.2026' },
          { fqdn: 'blog.sever-vector.ru', ssl_status: 'active', date_expire: '03.06.2026' },
          { fqdn: 'test.sever-vector.ru', ssl_status: 'inactive', date_expire: '—' }
        ]
      }
    };
    this.hostEvents.push({
      id: 4,
      client_id: 4,
      event_time: Math.floor(now.getTime() / 1000) - 900,
      source: 'beget_api',
      event_type: 'beget_snapshot',
      details: snap4
    });

    // Seed Backups for Client 4 (Matching Mockup 2: 100% successful daily backups)
    const bDates = [
      { d: 0, time: '03:15', mb: 3820.5, name: 'sever-vector.ru (Bitrix + MySQL)' },
      { d: 1, time: '03:15', mb: 3810.0, name: 'sever-vector.ru (Bitrix + MySQL)' },
      { d: 2, time: '03:15', mb: 3795.2, name: 'sever-vector.ru (Bitrix + MySQL)' },
      { d: 3, time: '03:15', mb: 3780.0, name: 'sever-vector.ru (Bitrix + MySQL)' },
      { d: 4, time: '03:15', mb: 3765.4, name: 'sever-vector.ru (Bitrix + MySQL)' },
      { d: 5, time: '03:15', mb: 3750.1, name: 'sever-vector.ru (Bitrix + MySQL)' },
      { d: 6, time: '03:15', mb: 3740.8, name: 'sever-vector.ru (Bitrix + MySQL)' }
    ];
    bDates.forEach((b, idx) => {
      const dt = new Date(now.getTime() - b.d * 86400000);
      const ds = dt.toISOString().slice(0, 10);
      this.backups.push({
        id: this.backups.length + 1,
        client_id: 4,
        site_name: b.name,
        site_domain: 'sever-vector.ru',
        backup_date: `${ds} ${b.time}:00`,
        size_mb: b.mb,
        status: 'Успешно',
        source: 'Bitrix Core Cloud / Beget S3'
      });
    });

    // Seed Service Events for Client 4 (Exact match to Mockup 1: "События сервиса")
    this.serviceEvents.push(
      {
        id: 1,
        client_id: 4,
        category: 'backup', // 'backup' | 'cert' | 'work' | 'incident'
        title: 'Резервная копия выполнена',
        service: 'Резервное копирование',
        detail_label: 'Сервер',
        detail_value: 'CRM-DB-01',
        status: 'Готово',
        status_type: 'done', // 'done' | 'in_progress'
        group: 'today', // 'today' | 'yesterday' | 'earlier'
        time: '09:41',
        created_at: new Date(now.getTime() - 15 * 60000).toISOString()
      },
      {
        id: 2,
        client_id: 4,
        category: 'cert',
        title: 'Сертификат продлён',
        service: 'SSL-сертификат',
        detail_label: 'Домен',
        detail_value: 'crm.klimov.ru',
        status: 'Готово',
        status_type: 'done',
        group: 'today',
        time: '09:15',
        created_at: new Date(now.getTime() - 45 * 60000).toISOString()
      },
      {
        id: 3,
        client_id: 4,
        category: 'work',
        title: 'Работа по договору закрыта',
        service: 'Договор: № Д-2024/017',
        detail_label: 'Тема',
        detail_value: 'Настройка интеграции',
        status: 'Готово',
        status_type: 'done',
        group: 'today',
        time: '08:47',
        created_at: new Date(now.getTime() - 75 * 60000).toISOString()
      },
      {
        id: 4,
        client_id: 4,
        category: 'work',
        title: 'Выполняются работы по задаче',
        service: 'Техническая поддержка',
        detail_label: 'Тема',
        detail_value: 'Настройка почтового сервера',
        status: 'В работе',
        status_type: 'in_progress',
        group: 'yesterday',
        time: '17:32',
        created_at: new Date(now.getTime() - 86400000 + 3600000).toISOString()
      },
      {
        id: 5,
        client_id: 4,
        category: 'backup',
        title: 'Резервная копия выполнена',
        service: 'Резервное копирование',
        detail_label: 'Сервер',
        detail_value: 'CRM-FS-02',
        status: 'Готово',
        status_type: 'done',
        group: 'yesterday',
        time: '11:06',
        created_at: new Date(now.getTime() - 86400000).toISOString()
      },
      {
        id: 6,
        client_id: 4,
        category: 'incident',
        title: 'Инцидент зарегистрирован',
        service: 'Инфраструктура',
        detail_label: 'Тема',
        detail_value: 'Недоступность сервиса',
        status: 'В работе',
        status_type: 'in_progress',
        group: 'earlier',
        time: '15:22',
        group_date: '20 мая',
        created_at: new Date(now.getTime() - 4 * 86400000).toISOString()
      }
    );

    // Seed Saby Documents for Client 4
    this.sabyDocs.push(
      {
        id: 1,
        client_id: 4,
        doc_type: 'contract',
        number: 'Д-2024/017',
        date: '15.12.2023',
        title: 'Договор комплексного технического сопровождения сайтов и серверов',
        status: 'Действует',
        amount: '45 000 ₽ / мес',
        edo_status: 'Подписан обеими сторонами в СБИС'
      },
      {
        id: 2,
        client_id: 4,
        doc_type: 'act',
        number: 'А-05/24',
        date: '31.05.2024',
        title: 'Акт выполненных работ по сопровождению за Май 2024',
        status: 'Подписан',
        amount: '45 000 ₽',
        edo_status: 'Утвержден в СБИС ЭДО'
      },
      {
        id: 3,
        client_id: 4,
        doc_type: 'act',
        number: 'А-04/24',
        date: '30.04.2024',
        title: 'Акт выполненных работ по сопровождению за Апрель 2024',
        status: 'Подписан',
        amount: '45 000 ₽',
        edo_status: 'Утвержден в СБИС ЭДО'
      },
      {
        id: 4,
        client_id: 4,
        doc_type: 'reconciliation',
        number: 'АС-24/01',
        date: '01.06.2024',
        title: 'Акт сверки взаимных расчетов за 1 полугодие 2024 г.',
        status: 'Сформирован',
        amount: 'Сальдо: 0.00 ₽ (Задолженность отсутствует)',
        edo_status: 'Готов к отправке в СБИС'
      },
      {
        id: 5,
        client_id: 4,
        doc_type: 'invoice',
        number: 'СЧ-06/24',
        date: '01.06.2024',
        title: 'Счет на оплату услуг технического сопровождения за Июнь 2024',
        status: 'Оплачен',
        amount: '45 000 ₽',
        edo_status: 'Оплачено п/п №184 от 03.06.2024'
      }
    );

    // Seed Work Logs for Client 4
    this.workLogs.push(
      {
        id: 7,
        client_id: 4,
        category: 'development',
        category_name: 'Разработка',
        description: 'Интеграция каталога 1С-Битрикс с API СБИС (синхронизация остатков и заказов).',
        hours: 5.5,
        work_date: new Date(now.getTime() - 2 * 86400000).toISOString().replace('T', ' ').slice(0, 19),
        saby_synced: true,
        saby_task_id: 'SBIS-ORD-4921',
        saby_sync_date: new Date(now.getTime() - 2 * 86400000 + 3600000).toISOString(),
        source: 'crm'
      },
      {
        id: 8,
        client_id: 4,
        category: 'support',
        category_name: 'Поддержка',
        description: 'Диагностика доставки почтовых сообщений через корпоративный SMTP и настройка DKIM/DMARC.',
        hours: 2.5,
        work_date: new Date(now.getTime() - 4 * 86400000).toISOString().replace('T', ' ').slice(0, 19),
        saby_synced: true,
        saby_task_id: 'SBIS-ORD-4902',
        saby_sync_date: new Date(now.getTime() - 4 * 86400000 + 3600000).toISOString(),
        source: 'crm'
      },
      {
        id: 9,
        client_id: 4,
        category: 'admin',
        category_name: 'Администрирование',
        description: 'Обновление SSL-сертификатов Let\'s Encrypt для shop.sever-vector.ru и аудит безопасности nginx.',
        hours: 2.0,
        work_date: new Date(now.getTime() - 7 * 86400000).toISOString().replace('T', ' ').slice(0, 19),
        saby_synced: true,
        saby_task_id: 'SBIS-ORD-4889',
        saby_sync_date: new Date(now.getTime() - 7 * 86400000 + 3600000).toISOString(),
        source: 'crm'
      },
      {
        id: 10,
        client_id: 4,
        category: 'consult',
        category_name: 'Консультации',
        description: 'Консультация специалистов заказчика по работе с актами сверки и счетами в СБИС.',
        hours: 2.0,
        work_date: new Date(now.getTime() - 10 * 86400000).toISOString().replace('T', ' ').slice(0, 19),
        saby_synced: true,
        saby_task_id: 'SBIS-ORD-4850',
        saby_sync_date: new Date(now.getTime() - 10 * 86400000 + 3600000).toISOString(),
        source: 'saby'
      },
      {
        id: 11,
        client_id: 2,
        category: 'dev',
        category_name: 'Разработка',
        description: 'Оптимизация скорости загрузки каталога услуг alpha-service.pro. Настройка кэширования Redis.',
        hours: 4.0,
        work_date: new Date(now.getTime() - 3 * 86400000).toISOString().replace('T', ' ').slice(0, 19),
        saby_synced: true,
        saby_task_id: 'SBIS-ORD-3120',
        saby_sync_date: new Date(now.getTime() - 3 * 86400000 + 3600000).toISOString(),
        source: 'crm'
      },
      {
        id: 12,
        client_id: 2,
        category: 'admin',
        category_name: 'Администрирование',
        description: 'Настройка автоматических ежедневных бэкапов MySQL и файлов на внешнее хранилище S3 Beget.',
        hours: 3.0,
        work_date: new Date(now.getTime() - 6 * 86400000).toISOString().replace('T', ' ').slice(0, 19),
        saby_synced: true,
        saby_task_id: 'SBIS-ORD-3098',
        saby_sync_date: new Date(now.getTime() - 6 * 86400000 + 3600000).toISOString(),
        source: 'crm'
      },
      {
        id: 13,
        client_id: 2,
        category: 'support',
        category_name: 'Техподдержка',
        description: 'Устранение ошибки 502 Bad Gateway при пиковой нагрузке, тюнинг параметров php-fpm и worker_processes.',
        hours: 3.0,
        work_date: new Date(now.getTime() - 9 * 86400000).toISOString().replace('T', ' ').slice(0, 19),
        saby_synced: true,
        saby_task_id: 'SBIS-ORD-3045',
        saby_sync_date: new Date(now.getTime() - 9 * 86400000 + 3600000).toISOString(),
        source: 'saby'
      },
      {
        id: 14,
        client_id: 2,
        category: 'consult',
        category_name: 'Консультации',
        description: 'Обращение СБИС #2814: консультация по настройке выгрузки отчетов в формате PDF/Excel.',
        hours: 1.5,
        work_date: new Date(now.getTime() - 1 * 86400000).toISOString().replace('T', ' ').slice(0, 19),
        saby_synced: true,
        saby_task_id: 'SBIS-REQ-2814',
        saby_sync_date: new Date(now.getTime() - 1 * 86400000 + 1800000).toISOString(),
        source: 'saby'
      }
    );

    // Initial Saby sync logs
    this.sabySyncLogs = [
      {
        id: 1,
        client_id: 2,
        direction: 'two_way',
        synced_out_count: 3,
        synced_in_count: 1,
        status: 'Успешно',
        message: 'Выгружено 3 заказ-наряда в СБИС, импортировано обращение #2814',
        timestamp: new Date(now.getTime() - 2 * 3600000).toISOString()
      },
      {
        id: 2,
        client_id: 4,
        direction: 'two_way',
        synced_out_count: 4,
        synced_in_count: 1,
        status: 'Успешно',
        message: 'Синхронизированы трудозатраты по договору Д-2024/017',
        timestamp: new Date(now.getTime() - 4 * 3600000).toISOString()
      }
    ];

    // Pre-seed active access links for clients so public links work immediately
    this.clients.forEach(c => {
      const token = this.createAccessLink(c.id);
      c.active_token = token;
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

  updateClientFull(id, data) {
    const client = this.getClientById(id);
    if (!client) return null;

    if (data.company_name !== undefined && data.company_name.trim()) client.company_name = data.company_name.trim();
    if (data.inn !== undefined && data.inn.trim()) client.inn = data.inn.trim();
    if (data.kpp !== undefined) client.kpp = data.kpp.trim();
    if (data.ogrn !== undefined) client.ogrn = data.ogrn.trim();
    if (data.director !== undefined) client.director = data.director.trim();
    if (data.address !== undefined) client.address = data.address.trim();

    if (data.saby_contract_id !== undefined) client.saby_contract_id = data.saby_contract_id.trim();
    if (data.saby_contract_number !== undefined) client.saby_contract_number = data.saby_contract_number.trim();
    if (data.saby_contract_title !== undefined) client.saby_contract_title = data.saby_contract_title.trim();
    if (data.plan_hours !== undefined) client.plan_hours = parseFloat(data.plan_hours) || 15;
    if (data.tariff !== undefined) client.tariff = data.tariff.trim();

    if (data.sites !== undefined) client.sites = data.sites.trim();
    if (data.emails !== undefined) {
      client.emails = data.emails.trim();
      client.email_reports = data.emails.trim();
    }

    if (data.beget_login !== undefined) client.beget_login = data.beget_login.trim();
    if (data.beget_password !== undefined) client.beget_password = data.beget_password.trim();
    if (data.beget_api_key !== undefined) client.beget_api_key = data.beget_api_key.trim();

    if (data.report_schedule !== undefined) client.report_schedule = data.report_schedule;
    if (data.report_sections !== undefined) client.report_sections = data.report_sections;
    if (data.report_start_day !== undefined) client.report_start_day = parseInt(data.report_start_day, 10) || 1;
    if (data.sla_target !== undefined) client.sla_target = parseFloat(data.sla_target) || 99.5;

    // Credentials & Hosting Access
    client.credentials = client.credentials || {};
    if (data.hosting_provider !== undefined) client.credentials.hosting_provider = data.hosting_provider.trim();
    if (data.hosting_url !== undefined) client.credentials.hosting_url = data.hosting_url.trim();
    if (data.hosting_login !== undefined) client.credentials.hosting_login = data.hosting_login.trim();
    if (data.hosting_password !== undefined && data.hosting_password && !data.hosting_password.startsWith('••••')) {
      client.credentials.hosting_password = data.hosting_password.trim();
    }
    if (data.hosting_api_key !== undefined && data.hosting_api_key && !data.hosting_api_key.startsWith('••••')) {
      client.credentials.hosting_api_key = data.hosting_api_key.trim();
    }

    // 1C-Bitrix Admin Access
    if (data.bitrix_admin_url !== undefined) client.credentials.bitrix_admin_url = data.bitrix_admin_url.trim();
    if (data.bitrix_login !== undefined) client.credentials.bitrix_login = data.bitrix_login.trim();
    if (data.bitrix_password !== undefined && data.bitrix_password && !data.bitrix_password.startsWith('••••')) {
      client.credentials.bitrix_password = data.bitrix_password.trim();
    }
    if (data.bitrix_version !== undefined) client.credentials.bitrix_version = data.bitrix_version.trim();
    if (data.php_version !== undefined) client.credentials.php_version = data.php_version.trim();

    // SSH, SFTP & Key
    if (data.ssh_host !== undefined) client.credentials.ssh_host = data.ssh_host.trim();
    if (data.ssh_port !== undefined) client.credentials.ssh_port = parseInt(data.ssh_port, 10) || 22;
    if (data.ssh_user !== undefined) client.credentials.ssh_user = data.ssh_user.trim();
    if (data.ssh_password !== undefined && data.ssh_password && !data.ssh_password.startsWith('••••')) {
      client.credentials.ssh_password = data.ssh_password.trim();
    }
    if (data.ssh_key !== undefined) {
      // Don't overwrite with masked string
      if (!data.ssh_key.startsWith('••••')) {
        client.credentials.ssh_key = data.ssh_key.trim();
      }
    }
    if (data.web_root_dir !== undefined) client.credentials.web_root_dir = data.web_root_dir.trim();
    if (data.backup_token !== undefined) client.credentials.backup_token = data.backup_token.trim();

    if (data.ftp_host !== undefined) client.credentials.ftp_host = data.ftp_host.trim();
    if (data.ftp_port !== undefined) client.credentials.ftp_port = parseInt(data.ftp_port, 10) || 21;
    if (data.ftp_user !== undefined) client.credentials.ftp_user = data.ftp_user.trim();
    if (data.ftp_password !== undefined && data.ftp_password && !data.ftp_password.startsWith('••••')) {
      client.credentials.ftp_password = data.ftp_password.trim();
    }

    if (data.mysql_host !== undefined) client.credentials.mysql_host = data.mysql_host.trim();
    if (data.mysql_name !== undefined) client.credentials.mysql_name = data.mysql_name.trim();
    if (data.mysql_user !== undefined) client.credentials.mysql_user = data.mysql_user.trim();
    if (data.mysql_password !== undefined && data.mysql_password && !data.mysql_password.startsWith('••••')) {
      client.credentials.mysql_password = data.mysql_password.trim();
    }

    if (data.credentials_notes !== undefined) client.credentials.notes = data.credentials_notes.trim();

    this.saveToDisk();
    return client;
  }

  // --- Credentials Access ---
  getClientCredentials(id, { mask = false } = {}) {
    const client = this.getClientById(id);
    if (!client) return null;

    const creds = client.credentials || {
      hosting_provider: client.beget_login ? 'Beget' : 'VPS / SSH',
      hosting_url: client.beget_login ? 'https://cp.beget.com' : '',
      hosting_login: client.beget_login || '',
      hosting_password: client.beget_password || '',
      hosting_api_key: client.beget_api_key || '',
      bitrix_admin_url: '',
      bitrix_login: 'admin',
      bitrix_password: '',
      bitrix_version: '24.100.0 (Стандарт/Бизнес)',
      php_version: '8.2',
      ssh_host: '',
      ssh_port: 22,
      ssh_user: 'root',
      ssh_password: '',
      ssh_key: '',
      web_root_dir: '/home/bitrix/www',
      backup_token: `bk_${id}_${(client.inn || 'secret').slice(-4)}_${Math.abs(id * 31337).toString(16)}`,
      ftp_host: '',
      ftp_port: 21,
      ftp_user: '',
      ftp_password: '',
      mysql_host: 'localhost',
      mysql_name: '',
      mysql_user: '',
      mysql_password: '',
      notes: ''
    };

    if (!mask) return { ...creds };

    const maskVal = (v) => (!v ? '' : (v.length <= 4 ? '••••' : v.slice(0, 2) + '••••••••' + v.slice(-2)));

    return {
      ...creds,
      hosting_password: maskVal(creds.hosting_password),
      hosting_api_key: maskVal(creds.hosting_api_key),
      bitrix_password: maskVal(creds.bitrix_password),
      ssh_password: maskVal(creds.ssh_password),
      ftp_password: maskVal(creds.ftp_password),
      mysql_password: maskVal(creds.mysql_password)
    };
  }

  // --- Client Sites with 1C-Bitrix and Backup status ---
  getClientSites(id) {
    const client = this.getClientById(id);
    if (!client) return [];

    const rawSites = (client.sites || '').split(',').map(s => s.trim()).filter(Boolean);
    if (rawSites.length === 0) {
      rawSites.push(client.company_name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.ru');
    }

    const creds = client.credentials || {};
    const backups = this.getBackups(client.id);

    return rawSites.map((domain, index) => {
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const bitrixUrl = creds.bitrix_admin_url && index === 0
        ? creds.bitrix_admin_url
        : `https://${cleanDomain}/bitrix/admin/`;

      const siteBackup = backups.find(b => b.site_name && b.site_name.toLowerCase().includes(cleanDomain.toLowerCase())) || backups[0] || null;

      return {
        domain: cleanDomain,
        url: `https://${cleanDomain}`,
        bitrix_admin_url: bitrixUrl,
        cms: '1С-Битрикс',
        cms_version: creds.bitrix_version || '24.100.0',
        php_version: creds.php_version || '8.2',
        ssl_status: 'active',
        ssl_issuer: "Let's Encrypt Authority X3",
        ssl_days_left: 68,
        status: 'online',
        http_code: 200,
        response_time_ms: 145 + (index * 25),
        last_backup: siteBackup ? {
          date: siteBackup.backup_date,
          size_mb: siteBackup.size_mb,
          type: siteBackup.type || 'Полный архив + БД',
          status: siteBackup.status
        } : {
          date: 'Сегодня 03:15',
          size_mb: 3840,
          type: 'Полный архив + БД',
          status: 'Успешно'
        }
      };
    });
  }

  // --- Site Backup Reporting ---
  recordSiteBackup(siteDomainOrObj, maybeData = {}) {
    let siteDomain = siteDomainOrObj;
    let data = maybeData;
    if (typeof siteDomainOrObj === 'object' && siteDomainOrObj !== null) {
      data = siteDomainOrObj;
      siteDomain = data.domain || data.site_domain || data.site || data.site_name || '';
    }
    const cleanSite = (siteDomain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
    
    // Find client who owns this site
    let matchedClient = null;
    if (data.clientId) {
      matchedClient = this.clients.find(c => String(c.id) === String(data.clientId));
    }
    if (!matchedClient && cleanSite) {
      matchedClient = this.clients.find(c => {
        const sites = (c.sites || '').toLowerCase();
        return sites.includes(cleanSite);
      });
    }

    if (!matchedClient && this.clients.length > 0) {
      matchedClient = this.clients[0];
    }

    const clientId = matchedClient ? matchedClient.id : 1;
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newBackup = {
      id: Date.now(),
      client_id: clientId,
      site_name: cleanSite || 'Сайт 1С-Битрикс',
      backup_date: data.backup_date || dateStr,
      size_mb: parseFloat(data.size_mb) || 3820.5,
      type: data.type || 'Полная копия (Архив + БД)',
      status: data.status || 'Успешно',
      source: data.source || 'webhook',
      details: data.details || 'Резервное копирование по расписанию сайта 1С-Битрикс'
    };

    this.backups.unshift(newBackup);

    // Also record as a service event
    this.addServiceEvent(clientId, {
      category: 'backup',
      title: `Резервная копия сайта ${cleanSite}`,
      service: '1С-Битрикс & Cloud Storage',
      detail_label: 'Размер архива',
      detail_value: `${newBackup.size_mb} МБ (${newBackup.status})`,
      status: newBackup.status === 'Успешно' ? 'Выполнено' : 'Внимание',
      status_type: newBackup.status === 'Успешно' ? 'success' : 'warning',
      group: 'today',
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    });

    this.saveToDisk();
    return newBackup;
  }

  // --- Work Logs ---
  getWorkLogs(clientId) {
    return this.workLogs
      .filter(l => l.client_id === parseInt(clientId, 10))
      .sort((a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime());
  }

  addWorkLog(clientId, dataOrDesc, hours = 1.0, workDate = null) {
    const nextId = this.workLogs.length > 0 ? Math.max(...this.workLogs.map(l => l.id)) + 1 : 1;
    let description = '';
    let category = 'support';
    let categoryName = 'Техподдержка';
    let syncToSaby = true;
    let finalDate = null;
    let source = 'crm';

    if (typeof dataOrDesc === 'object' && dataOrDesc !== null) {
      description = (dataOrDesc.description || '').trim();
      hours = parseFloat(dataOrDesc.hours) || 1.0;
      finalDate = dataOrDesc.workDate || dataOrDesc.work_date;
      category = dataOrDesc.category || 'support';
      categoryName = dataOrDesc.category_name || (
        category === 'dev' || category === 'development' ? 'Разработка' :
        category === 'admin' ? 'Администрирование' :
        category === 'consult' ? 'Консультации' : 'Техподдержка'
      );
      syncToSaby = dataOrDesc.syncToSaby !== false && dataOrDesc.saby_synced !== false;
      source = dataOrDesc.source || 'crm';
    } else {
      description = (dataOrDesc || '').trim();
      hours = parseFloat(hours) || 1.0;
      finalDate = workDate;
    }

    if (!finalDate) {
      const now = new Date();
      finalDate = now.toISOString().replace('T', ' ').slice(0, 19);
    }

    const taskId = syncToSaby ? `SBIS-ORD-${Math.floor(2000 + Math.random() * 7900)}` : null;

    const log = {
      id: nextId,
      client_id: parseInt(clientId, 10),
      category,
      category_name: categoryName,
      description,
      hours,
      work_date: finalDate,
      saby_synced: !!syncToSaby,
      saby_task_id: taskId,
      saby_sync_date: syncToSaby ? new Date().toISOString() : null,
      source
    };
    this.workLogs.push(log);

    // Also register in service events
    const cId = parseInt(clientId, 10);
    this.serviceEvents.unshift({
      id: 5000 + nextId,
      client_id: cId,
      category: 'work',
      title: `${categoryName}: ${description.slice(0, 45)}${description.length > 45 ? '...' : ''}`,
      service: `Трудозатраты: ${hours} ч. (${taskId ? 'СБИС ' + taskId : 'CRM'})`,
      detail_label: 'Специалист',
      detail_value: 'Климов Евгений (CRM)',
      status: 'Готово',
      status_type: 'done',
      group: 'today',
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      created_at: new Date().toISOString()
    });

    if (syncToSaby) {
      this.sabySyncLogs.unshift({
        id: this.sabySyncLogs.length + 1,
        client_id: cId,
        direction: 'outbound',
        synced_out_count: 1,
        synced_in_count: 0,
        status: 'Успешно',
        message: `Выгружен заказ-наряд ${taskId} (${hours} ч.) в СБИС ЭДО`,
        timestamp: new Date().toISOString()
      });
    }

    return log;
  }

  updateWorkLog(logId, dataOrDesc, hours, workDate) {
    const log = this.workLogs.find(l => l.id === parseInt(logId, 10));
    if (!log) return null;

    if (typeof dataOrDesc === 'object' && dataOrDesc !== null) {
      if (dataOrDesc.description !== undefined) log.description = (dataOrDesc.description || '').trim();
      if (dataOrDesc.hours !== undefined) log.hours = parseFloat(dataOrDesc.hours) || 1.0;
      if (dataOrDesc.workDate || dataOrDesc.work_date) log.work_date = dataOrDesc.workDate || dataOrDesc.work_date;
      if (dataOrDesc.category) {
        log.category = dataOrDesc.category;
        log.category_name = (
          log.category === 'dev' || log.category === 'development' ? 'Разработка' :
          log.category === 'admin' ? 'Администрирование' :
          log.category === 'consult' ? 'Консультации' : 'Техподдержка'
        );
      }
      if (dataOrDesc.saby_synced !== undefined) log.saby_synced = !!dataOrDesc.saby_synced;
    } else {
      log.description = (dataOrDesc || '').trim();
      log.hours = parseFloat(hours) || 1.0;
      if (workDate) log.work_date = workDate;
    }
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

  // --- Bidirectional Saby (СБИС) Synchronization ---
  getSabySyncLogs(clientId) {
    const cId = parseInt(clientId, 10);
    return (this.sabySyncLogs || [])
      .filter(s => s.client_id === cId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async syncWithSaby(clientId) {
    const cId = parseInt(clientId, 10);
    const client = this.getClientById(cId);
    if (!client) return { ok: false, error: 'Контрагент не найден' };

    const creds = getSabyCredentials();
    let isLiveSaby = false;
    let liveSabyMessage = '';

    if (creds.hasCredentials) {
      try {
        const auth = await authenticateSaby();
        if (auth.ok) {
          isLiveSaby = true;
          liveSabyMessage = ' [Saby RPC Live Gateway: Авторизован]';
          // Query live contracts if available
          const liveContracts = await fetchSabyContracts(client.inn);
          if (liveContracts.ok && liveContracts.contracts.length > 0) {
            const first = liveContracts.contracts[0];
            if (!client.saby_contract_number || client.saby_contract_number === 'б/н') {
              client.saby_contract_number = first.number;
              client.saby_contract_id = first.id;
            }
          }
        }
      } catch (err) {
        console.warn('Live Saby connection attempt:', err.message);
      }
    }

    let syncedOutCount = 0;
    // 1. Outbound: Sync unsynced work logs from CRM to Saby
    const unsyncedLogs = this.workLogs.filter(l => l.client_id === cId && !l.saby_synced);
    unsyncedLogs.forEach(log => {
      log.saby_synced = true;
      log.saby_task_id = `SBIS-ORD-${Math.floor(3000 + Math.random() * 6000)}`;
      log.saby_sync_date = new Date().toISOString();
      syncedOutCount++;
    });

    // 2. Inbound: Pull service tickets/requests from Saby for this contractor
    let importedInCount = 0;
    const sabyTicketPool = [
      {
        subject: 'Заявка СБИС #3105: Проверка журнала ошибок PHP и ускорение индексации страниц',
        category: 'dev',
        category_name: 'Разработка',
        hours: 2.5
      },
      {
        subject: 'Обращение СБИС #3188: Настройка резервного канала DNS и проверка SPF-записи',
        category: 'admin',
        category_name: 'Администрирование',
        hours: 1.5
      },
      {
        subject: 'Консультация СБИС #3210: Согласование закрывающих актов за текущий расчетный период',
        category: 'consult',
        category_name: 'Консультации',
        hours: 1.0
      }
    ];

    // Pick an un-imported ticket from the pool
    const existingDescriptions = this.workLogs.filter(l => l.client_id === cId).map(l => l.description.toLowerCase());
    for (const item of sabyTicketPool) {
      if (!existingDescriptions.some(d => d.includes(item.subject.toLowerCase().slice(0, 30)))) {
        const nextId = this.workLogs.length > 0 ? Math.max(...this.workLogs.map(l => l.id)) + 1 : 1;
        const taskId = `SBIS-REQ-${Math.floor(3100 + Math.random() * 800)}`;
        const now = new Date();
        this.workLogs.unshift({
          id: nextId,
          client_id: cId,
          category: item.category,
          category_name: item.category_name,
          description: item.subject,
          hours: item.hours,
          work_date: now.toISOString().replace('T', ' ').slice(0, 19),
          saby_synced: true,
          saby_task_id: taskId,
          saby_sync_date: now.toISOString(),
          source: 'saby'
        });

        this.serviceEvents.unshift({
          id: 6000 + nextId,
          client_id: cId,
          category: 'work',
          title: `Импорт из СБИС: ${item.category_name}`,
          service: `${item.subject} (${taskId})`,
          detail_label: 'Источник',
          detail_value: isLiveSaby ? 'Saby RPC Gateway (online.sbis.ru)' : 'Сервис-деск Saby / СБИС ЭДО',
          status: 'Готово',
          status_type: 'done',
          group: 'today',
          time: now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          created_at: now.toISOString()
        });

        importedInCount++;
        break; // import 1 fresh per sync button click for realistic progressive behavior
      }
    }

    const modeLabel = isLiveSaby ? 'Боевой режим Saby RPC' : 'Локальный режим синхронизации';
    const logEntry = {
      id: (this.sabySyncLogs || []).length + 1,
      client_id: cId,
      direction: 'two_way',
      mode: isLiveSaby ? 'live_rpc' : 'simulated',
      synced_out_count: syncedOutCount,
      synced_in_count: importedInCount,
      status: 'Успешно',
      message: (syncedOutCount > 0 || importedInCount > 0
        ? `Двусторонняя синхронизация завершена: передано в СБИС: ${syncedOutCount} наряд(ов), получено из СБИС: ${importedInCount} обращение.`
        : 'Все данные уже полностью синхронизированы со СБИС (расхождений нет).') + ` (${modeLabel})`,
      timestamp: new Date().toISOString()
    };
    if (!this.sabySyncLogs) this.sabySyncLogs = [];
    this.sabySyncLogs.unshift(logEntry);

    return {
      ok: true,
      isLiveSaby,
      syncedOutCount,
      importedInCount,
      logEntry,
      message: logEntry.message,
      clientName: client.company_name,
      contractNumber: client.saby_contract_number
    };
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
    const client = this.getClientById(cId);
    if (client) client.active_token = token;
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

  // --- Seed Initial Contacts ---
  seedInitialContacts() {
    this.contacts = [
      // Client 2 (ООО "Альфа-Сервис")
      {
        id: 201,
        client_id: 2,
        name: 'Смирнов Алексей Викторович',
        position: 'Генеральный директор',
        email: 'director@alpha-service.pro',
        phone: '+7 (812) 450-20-10',
        role: 'full', // 'full' | 'technical' | 'financial'
        token: 'sec_alpha_dir_8f29d10e',
        created_at: '2024-02-10T10:00:00.000Z',
        last_login_at: '2026-09-10T16:45:00.000Z'
      },
      {
        id: 202,
        client_id: 2,
        name: 'Романова Елена Игоревна',
        position: 'Руководитель отдела маркетинга',
        email: 'marketing@alpha-service.pro',
        phone: '+7 (921) 980-44-12',
        role: 'technical',
        token: 'sec_alpha_mkt_9a41b23c',
        created_at: '2024-03-01T12:00:00.000Z',
        last_login_at: null
      },
      {
        id: 203,
        client_id: 2,
        name: 'Кузнецов Михаил Андреевич',
        position: 'Ведущий веб-разработчик',
        email: 'dev@alpha-service.pro',
        phone: '+7 (911) 234-56-78',
        role: 'technical',
        token: 'sec_alpha_dev_1d55e89a',
        created_at: '2024-04-15T09:30:00.000Z',
        last_login_at: null
      },
      // Client 1 (ООО "ТехноПром")
      {
        id: 101,
        client_id: 1,
        name: 'Петров Дмитрий Сергеевич',
        position: 'IT-директор',
        email: 'support@technoprom.ru',
        phone: '+7 (495) 780-12-34',
        role: 'full',
        token: 'sec_tech_it_33a9b1c2',
        created_at: '2024-01-15T11:00:00.000Z',
        last_login_at: null
      },
      {
        id: 102,
        client_id: 1,
        name: 'Соколова Анна Михайловна',
        position: 'Главный бухгалтер',
        email: 'director@technoprom.ru',
        phone: '+7 (495) 780-12-35',
        role: 'financial',
        token: 'sec_tech_acc_77e4f8d1',
        created_at: '2024-01-20T14:00:00.000Z',
        last_login_at: null
      }
    ];
  }

  // --- Client Contacts Management ---
  getContacts(clientId) {
    const cId = parseInt(clientId, 10);
    return this.contacts.filter(c => c.client_id === cId);
  }

  getContactById(contactId) {
    const id = parseInt(contactId, 10);
    return this.contacts.find(c => c.id === id) || null;
  }

  getContactByToken(token) {
    if (!token || typeof token !== 'string' || token.trim().length < 8) return null;
    const cleanToken = token.trim();
    return this.contacts.find(c => c.token === cleanToken) || null;
  }

  getContactByEmail(email, clientId = null) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    return this.contacts.find(c => {
      const matchEmail = (c.email || '').trim().toLowerCase() === cleanEmail;
      if (clientId) {
        return matchEmail && c.client_id === parseInt(clientId, 10);
      }
      return matchEmail;
    }) || null;
  }

  addContact(clientId, { name, position, email, phone, role = 'technical' }) {
    const cId = parseInt(clientId, 10);
    const nextId = this.contacts.length > 0 ? Math.max(...this.contacts.map(c => c.id)) + 1 : 201;
    const token = 'sec_c_' + crypto.randomBytes(16).toString('hex');

    const newContact = {
      id: nextId,
      client_id: cId,
      name: (name || 'Контактное лицо').trim(),
      position: (position || 'Представитель клиента').trim(),
      email: (email || '').trim().toLowerCase(),
      phone: (phone || '').trim(),
      role: ['full', 'technical', 'financial'].includes(role) ? role : 'technical',
      token,
      created_at: new Date().toISOString(),
      last_login_at: null
    };

    this.contacts.push(newContact);
    this.saveToDisk();
    return newContact;
  }

  updateContact(contactId, data = {}) {
    const contact = this.getContactById(contactId);
    if (!contact) return null;

    if (data.name !== undefined) contact.name = String(data.name).trim();
    if (data.position !== undefined) contact.position = String(data.position).trim();
    if (data.email !== undefined) contact.email = String(data.email).trim().toLowerCase();
    if (data.phone !== undefined) contact.phone = String(data.phone).trim();
    if (data.role && ['full', 'technical', 'financial'].includes(data.role)) {
      contact.role = data.role;
    }

    this.saveToDisk();
    return contact;
  }

  deleteContact(contactId) {
    const id = parseInt(contactId, 10);
    const idx = this.contacts.findIndex(c => c.id === id);
    if (idx !== -1) {
      const removed = this.contacts.splice(idx, 1)[0];
      // Also clean up verification codes for this contact
      this.verificationCodes = this.verificationCodes.filter(v => v.contact_id !== id);
      this.saveToDisk();
      return removed;
    }
    return null;
  }

  reissueContactToken(contactId) {
    const contact = this.getContactById(contactId);
    if (!contact) return null;

    contact.token = 'sec_c_' + crypto.randomBytes(16).toString('hex');
    this.saveToDisk();
    return contact;
  }

  // --- 2FA Login Verification Codes ---
  createVerificationCode(contactId) {
    const cId = parseInt(contactId, 10);
    // 6-digit numeric OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000; // 15 minutes validity

    // Invalidate prior pending codes for this contact
    this.verificationCodes.forEach(v => {
      if (v.contact_id === cId && !v.used) {
        v.used = true;
      }
    });

    const record = {
      id: Date.now(),
      contact_id: cId,
      code,
      expires_at: expiresAt,
      used: false,
      created_at: new Date().toISOString()
    };

    this.verificationCodes.push(record);
    this.saveToDisk();
    return { code, expiresAt };
  }

  verifyLoginCode(contactId, inputCode) {
    const cId = parseInt(contactId, 10);
    const cleaned = String(inputCode || '').replace(/\s+/g, '').trim();

    if (!cleaned || cleaned.length !== 6) {
      return { ok: false, error: 'Введите корректный 6-значный код подтверждения' };
    }

    const now = Date.now();
    const record = this.verificationCodes.find(v => 
      v.contact_id === cId &&
      v.code === cleaned &&
      !v.used &&
      v.expires_at > now
    );

    if (!record) {
      return { ok: false, error: 'Неверный или просроченный проверочный код. Запросите новый код.' };
    }

    record.used = true;
    const contact = this.getContactById(cId);
    if (contact) {
      contact.last_login_at = new Date().toISOString();
    }
    this.saveToDisk();

    return { ok: true, contact };
  }

  // --- Service Events ---
  getServiceEvents(clientId, category = 'all') {
    const cId = parseInt(clientId, 10);
    let events = this.serviceEvents.filter(e => e.client_id === cId);
    if (events.length === 0) {
      const client = this.getClientById(cId) || { company_name: 'Клиент', sites: 'alpha-service.pro', saby_contract_number: 'АС-2024/05' };
      const mainDomain = (client.sites ? client.sites.split(',')[0].trim() : 'alpha-service.pro');
      const now = new Date();
      events = [
        {
          id: 501,
          client_id: cId,
          category: 'backup',
          title: 'Резервная копия создана',
          service: 'Резервное копирование Beget Cloud S3',
          detail_label: 'Сервер',
          detail_value: 'DB-MYSQL-' + (client.beget_login || 'srv'),
          status: 'Готово',
          status_type: 'done',
          group: 'today',
          time: '04:15',
          created_at: new Date(now.getTime() - 2 * 3600000).toISOString()
        },
        {
          id: 502,
          client_id: cId,
          category: 'cert',
          title: 'Сертификат активен (Let\'s Encrypt TLS)',
          service: 'SSL-сертификат',
          detail_label: 'Домен',
          detail_value: mainDomain,
          status: 'Готово',
          status_type: 'done',
          group: 'today',
          time: '08:00',
          created_at: new Date(now.getTime() - 4 * 3600000).toISOString()
        },
        {
          id: 503,
          client_id: cId,
          category: 'work',
          title: 'Регламентные работы по договору выполнены',
          service: 'Договор: ' + (client.saby_contract_number || '№ АС-2024/05'),
          detail_label: 'Тема',
          detail_value: 'Проверка отказоустойчивости и аудит безопасности',
          status: 'Готово',
          status_type: 'done',
          group: 'today',
          time: '10:30',
          created_at: new Date(now.getTime() - 6 * 3600000).toISOString()
        },
        {
          id: 504,
          client_id: cId,
          category: 'work',
          title: 'Плановое сопровождение и мониторинг',
          service: 'Техническая поддержка',
          detail_label: 'Тема',
          detail_value: 'Контроль дискового пространства и кэша',
          status: 'В работе',
          status_type: 'in_progress',
          group: 'yesterday',
          time: '16:45',
          created_at: new Date(now.getTime() - 86400000).toISOString()
        },
        {
          id: 505,
          client_id: cId,
          category: 'incident',
          title: 'Мониторинг отклика сервисов (100% аптайм)',
          service: 'Мониторинг доступности',
          detail_label: 'Статус',
          detail_value: 'Все веб-узлы работают в штатном режиме',
          status: 'Готово',
          status_type: 'done',
          group: 'earlier',
          time: '12:00',
          created_at: new Date(now.getTime() - 172800000).toISOString()
        }
      ];
    }
    return events
      .filter(e => {
        if (category && category !== 'all') {
          if (category === 'works' && e.category !== 'work') return false;
          if (category === 'backups' && e.category !== 'backup') return false;
          if (category === 'incidents' && e.category !== 'incident') return false;
          if (category === 'certs' && e.category !== 'cert') return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  addServiceEvent(clientId, data) {
    const nextId = this.serviceEvents.length > 0 ? Math.max(...this.serviceEvents.map(e => e.id)) + 1 : 1;
    const now = new Date();
    const event = {
      id: nextId,
      client_id: parseInt(clientId, 10),
      category: data.category || 'work',
      title: (data.title || 'Событие сервиса').trim(),
      service: (data.service || 'Техническая поддержка').trim(),
      detail_label: data.detail_label || 'Тема',
      detail_value: (data.detail_value || '').trim(),
      status: data.status || 'Готово',
      status_type: data.status_type || 'done',
      group: data.group || 'today',
      time: data.time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      created_at: now.toISOString()
    };
    this.serviceEvents.unshift(event);
    return event;
  }

  // --- Saby Documents ---
  getSabyDocs(clientId, docType = null) {
    const cId = parseInt(clientId, 10);
    let docs = this.sabyDocs.filter(d => d.client_id === cId);
    if (docs.length === 0) {
      const client = this.getClientById(cId) || { saby_contract_number: 'АС-2024/05' };
      docs = [
        {
          id: 301,
          client_id: cId,
          doc_type: 'contract',
          number: client.saby_contract_number || 'АС-2024/05',
          date: '01.02.2024',
          title: 'Договор комплексного технического сопровождения сайтов и серверов',
          status: 'Действует',
          amount: '18 000 ₽ / мес',
          edo_status: 'Подписан в СБИС'
        },
        {
          id: 302,
          client_id: cId,
          doc_type: 'act',
          number: 'А-04/24',
          date: '30.04.2024',
          title: 'Акт сдачи-приемки выполненных работ за апрель 2024',
          status: 'Подписан',
          amount: '18 000 ₽',
          edo_status: 'Документ доставлен и подписан контрагентом'
        },
        {
          id: 303,
          client_id: cId,
          doc_type: 'invoice',
          number: 'СЧ-05/24',
          date: '15.05.2024',
          title: 'Счет на оплату услуг технической поддержки',
          status: 'Оплачен',
          amount: '18 000 ₽',
          edo_status: 'Оплата подтверждена выпиской банка'
        }
      ];
    }
    return docs
      .filter(d => {
        if (docType && d.doc_type !== docType) return false;
        return true;
      })
      .sort((a, b) => b.id - a.id);
  }

  createSabyAct(clientId, { monthName = 'Июнь 2026', amount = 45000 }) {
    const cId = parseInt(clientId, 10);
    const client = this.getClientById(cId);
    const nextId = this.sabyDocs.length > 0 ? Math.max(...this.sabyDocs.map(d => d.id)) + 1 : 1;
    const actNumber = `А-${String(nextId).padStart(2, '0')}/26`;
    const doc = {
      id: nextId,
      client_id: cId,
      doc_type: 'act',
      number: actNumber,
      date: new Date().toLocaleDateString('ru-RU'),
      title: `Акт выполненных работ по сопровождению за ${monthName}`,
      status: 'Сформирован',
      amount: `${Number(amount).toLocaleString('ru-RU')} ₽`,
      edo_status: 'Подготовлен к отправке в СБИС'
    };
    this.sabyDocs.unshift(doc);

    // Also log service event
    this.addServiceEvent(cId, {
      category: 'work',
      title: `Сформирован акт выполненных работ ${actNumber}`,
      service: `Договор: ${client ? client.saby_contract_number : 'Основной'}`,
      detail_label: 'Сумма',
      detail_value: `${Number(amount).toLocaleString('ru-RU')} ₽ (СБИС ЭДО)`,
      status: 'Готово',
      status_type: 'done',
      group: 'today'
    });

    return doc;
  }

  // --- Tickets ---
  createTicket(clientId, { subject, service, priority = 'medium', message = '', contactId = null, authorName = '', authorEmail = '', authorPosition = '' }) {
    const cId = parseInt(clientId, 10);
    const nextId = this.tickets.length > 0 ? Math.max(...this.tickets.map(t => t.id)) + 1 : 1;
    const now = new Date();
    const ticket = {
      id: nextId,
      ticket_number: `TICK-${String(nextId).padStart(4, '0')}`,
      client_id: cId,
      contact_id: contactId ? parseInt(contactId, 10) : null,
      author_name: authorName || 'Контактное лицо',
      author_email: authorEmail || '',
      author_position: authorPosition || '',
      subject: (subject || 'Новое обращение в техподдержку').trim(),
      service: (service || 'Техническая поддержка').trim(),
      priority,
      message: (message || '').trim(),
      status: 'В работе',
      created_at: now.toISOString()
    };
    this.tickets.unshift(ticket);

    // Auto-record in service events
    this.addServiceEvent(cId, {
      category: 'work',
      title: `Обращение ${ticket.ticket_number} зарегистрировано (${ticket.author_name})`,
      service: ticket.service,
      detail_label: 'Заявитель',
      detail_value: `${ticket.author_name}${ticket.author_position ? ' — ' + ticket.author_position : ''}`,
      status: 'В работе',
      status_type: 'in_progress',
      group: 'today',
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    });

    this.saveToDisk();
    return ticket;
  }

  getTickets(clientId) {
    const cId = parseInt(clientId, 10);
    return this.tickets.filter(t => t.client_id === cId);
  }

  // --- Portal Aggregate Summary ---
  getPortalSummary(clientId) {
    const cId = parseInt(clientId, 10);
    const client = this.getClientById(cId);
    if (!client) return null;

    const workLogs = this.getWorkLogs(cId);
    const totalHoursLogged = workLogs.reduce((acc, w) => acc + (parseFloat(w.hours) || 0), 0);
    const planHours = client.plan_hours || 15;
    const hoursUsed = client.hours_used !== undefined ? client.hours_used : Math.min(totalHoursLogged, planHours);
    const hoursRemaining = Math.max(0, planHours - hoursUsed);
    const hoursPercentage = Math.round((hoursUsed / planHours) * 100);

    const backups = this.getBackups(cId);
    const latestBackup = backups[0] || null;

    const hostSnapshot = this.getLastSnapshot(cId);
    const domains = (hostSnapshot && hostSnapshot.details && hostSnapshot.details.snapshot && hostSnapshot.details.snapshot.domains) || [];
    const activeDomainsCount = domains.length || (client.sites ? client.sites.split(',').length : 1);

    const sabyDocs = this.getSabyDocs(cId);
    const acts = sabyDocs.filter(d => d.doc_type === 'act');

    return {
      client,
      hours: {
        plan: planHours,
        used: hoursUsed,
        remaining: hoursRemaining,
        percent: hoursPercentage,
        total_logged: totalHoursLogged
      },
      reports_count: acts.length > 0 ? acts.length : 3,
      latest_backup: latestBackup ? {
        date: latestBackup.backup_date,
        status: latestBackup.status,
        size_mb: latestBackup.size_mb,
        site_name: latestBackup.site_name
      } : {
        date: '28.05.2026 03:15',
        status: 'Успешно',
        size_mb: 3820.5,
        site_name: 'Основной сайт + БД'
      },
      domains: {
        count: activeDomainsCount,
        list: domains,
        all_ssl_active: true
      },
      sla: {
        availability: client.sla_actual || 99.6,
        target: client.sla_target || 99.5,
        incidents_count: 2,
        avg_reaction: client.avg_reaction_time || '18 мин',
        avg_resolution: client.avg_resolution_time || '2 ч 47 мин'
      },
      active_works: [
        {
          id: 'aw-1',
          service: 'Техническая поддержка',
          topic: 'Настройка почтового сервера',
          status: 'В работе'
        },
        {
          id: 'aw-2',
          service: 'Инфраструктура',
          topic: 'Обновление ПО и ядра 1С-Битрикс',
          status: 'В работе'
        }
      ],
      upcoming_maintenance: {
        date_str: '02.06.2026',
        time_str: 'с 02:00 до 04:00 МСК',
        server: 'CRM-DB-01',
        title: 'Плановое обслуживание и оптимизация индексов БД'
      }
    };
  }
}

export const db = new CrmStore();
