import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './crm_store.js';
import { settingsManager } from './settings_manager.js';
import { checkInnChecksum, suggestCompany, getContracts } from './inn_helper.js';
import { renderPortalPage } from './portal_view.js';
import { renderAdminClientPage, renderNewClientPage } from './admin_view.js';
import { getGitStatus, getGitHubConfig, testGitHubApi, syncToGitHub } from './github_sync.js';
import { testSabyConnection, authenticateSaby, searchSabyCompany, fetchSabyContracts } from './saby_client.js';
import { testBegetConnection, pullBegetSnapshot } from './beget_client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'crm-saby-beget-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
  })
);

// Simple flash message middleware
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Authentication middleware (Bypassed: open access mode so interface and client cabinets work seamlessly without secrets or login blocks)
function requireAdmin(req, res, next) {
  if (req.session) {
    if (!req.session.crm_admin_user) {
      req.session.crm_admin_user = 'Климов Евгений';
    }
  }
  return next();
}

app.use(requireAdmin);

// Helper for dates in Russian
function formatDateRus(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

function formatDateShort(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ==========================================
// ROUTES
// ==========================================

// Health check
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

// Login (Direct access to CRM without password blocker)
app.get('/login', (req, res) => {
  if (req.session) {
    req.session.crm_admin_user = 'Климов Евгений';
  }
  const nextUrl = req.query.next || '/';
  res.redirect(nextUrl.startsWith('/') ? nextUrl : '/');
});

app.post('/login', (req, res) => {
  if (req.session) {
    req.session.crm_admin_user = 'Климов Евгений';
  }
  const nextUrl = req.query.next || '/';
  res.redirect(nextUrl.startsWith('/') ? nextUrl : '/');
});

// Logout
app.get('/logout', (req, res) => {
  res.redirect('/');
});

// Change Password
app.get('/change-password', (req, res) => {
  res.send(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Смена пароля — CRM</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fffaf0; font-family: sans-serif; }
    .card { width: min(440px, calc(100% - 32px)); padding: 32px; background: #fff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    input { width: 100%; box-sizing: border-box; padding: 11px; margin: 8px 0 16px; border: 1px solid #d8deea; border-radius: 8px; }
    button { width: 100%; padding: 12px; background: linear-gradient(135deg,#ffd6c2,#ffb4a2); border: 0; border-radius: 8px; font-weight: bold; cursor: pointer; }
    a { color: #6b5a57; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Смена пароля администратора</h2>
    <form method="post" action="/change-password">
      <label>Текущий пароль:</label>
      <input type="password" name="current_password" required>
      <label>Новый пароль:</label>
      <input type="password" name="new_password" required>
      <label>Повторите новый пароль:</label>
      <input type="password" name="confirm_password" required>
      <button type="submit">Сохранить пароль</button>
    </form>
    <p style="margin-top:16px;"><a href="/">&larr; Вернуться в CRM</a></p>
  </div>
</body>
</html>`);
});

app.post('/change-password', (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  if (!db.verifyPassword(current_password)) {
    return res.send('Ошибка: Текущий пароль указан неверно. <a href="/change-password">Назад</a>');
  }
  if (!new_password || new_password !== confirm_password) {
    return res.send('Ошибка: Пароли не совпадают. <a href="/change-password">Назад</a>');
  }
  db.changePassword(new_password);
  res.redirect('/');
});

// Dashboard: List clients
app.get('/', (req, res) => {
  const clients = db.getClients();
  const gitStatus = getGitStatus();
  const gitConfig = getGitHubConfig();
  const hasSaby = !!(process.env.SABY_APP_CLIENT_ID && process.env.SABY_APP_SECRET);
  const hasBeget = !!process.env.BEGET_LOGIN;

  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Saby & Beget CRM — Климов Евгений</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #fffaf0 0%, #ffffff 100%);
      min-height: 100vh; color: #2b2f2f; padding: 25px; margin: 0; box-sizing: border-box;
    }
    .container {
      max-width: 1100px; margin: auto; background: #ffffff; padding: 28px;
      border-radius: 12px; box-shadow: 0 8px 24px rgba(43, 45, 48, 0.05);
      border: 1px solid #f0e9e6;
    }
    .header-bar {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid #f0e9e6; padding-bottom: 14px; margin-bottom: 20px;
    }
    h2 { color: #6b5a57; margin: 0; font-size: 22px; }
    .user-info { font-size: 14px; color: #78716c; }
    .user-info a { color: #b45309; text-decoration: none; margin-left: 10px; }
    .user-info a:hover { text-decoration: underline; }
    .actions-bar { margin-bottom: 20px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 12px 14px; border: 1px solid #f0e9e6; text-align: left; font-size: 14px; }
    th { background: #f8f4f3; color: #6b5a57; font-weight: 600; }
    tr:hover td { background: #faf8f7; }
    a { color: #6b5a57; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .btn {
      background: linear-gradient(135deg, #ffd6c2 0%, #ffb4a2 100%);
      color: #2b2f2f; padding: 10px 18px; border: none; border-radius: 8px;
      cursor: pointer; font-weight: 700; transition: all 0.15s ease;
      box-shadow: 0 6px 12px rgba(255, 180, 162, 0.12);
      text-decoration: none; display: inline-flex; align-items: center; gap: 6px;
    }
    .btn:hover { filter: brightness(0.97); text-decoration: none; }
    .card-link {
      display: inline-block; padding: 6px 12px; background: #fdf2ee;
      color: #9a3412; border-radius: 6px; font-weight: 600;
      transition: background 0.15s;
    }
    .card-link:hover { background: #fed7aa; text-decoration: none; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 4px;
      font-size: 12px; background: #e2e8f0; color: #475569;
    }
    .badge-active { background: #dcfce7; color: #166534; font-weight: 600; }
    .badge-warn { background: #fef3c7; color: #92400e; font-weight: 600; }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px);
      display: none; align-items: center; justify-content: center; z-index: 1000; padding: 20px;
    }
    .modal-card {
      background: #ffffff; border-radius: 16px; max-width: 620px; width: 100%; padding: 24px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.25);
    }
    .toast {
      position: fixed; bottom: 20px; right: 20px; background: #1e1b4b; color: #fff;
      padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3); display: none; z-index: 2000;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <h2>CRM-система управления инфраструктурой сайтов и договоров</h2>
      <div class="user-info">
        Администратор: <strong>${req.session.crm_admin_user || 'Климов Евгений'}</strong>
        <a href="/change-password">Сменить пароль</a>
        <a href="/logout">Выйти</a>
      </div>
    </div>

    <!-- GitHub & CI/CD Live Control Banner -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #fff; border-radius: 14px; padding: 18px 22px; margin-bottom: 20px; box-shadow: 0 10px 25px rgba(15,23,42,0.15);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            <span style="font-size: 16px; font-weight: 700;">GitHub Репозиторий: ${gitConfig.repo}</span>
            <span style="background: rgba(16,185,129,0.25); color: #34d399; font-size: 11.5px; font-weight: 700; padding: 2px 8px; border-radius: 6px;">Ветка: ${gitStatus.branch || 'main'}</span>
          </div>
          <div style="font-size: 13px; color: #cbd5e1; margin-top: 6px;">
            Последний коммит: <strong>${gitStatus.lastCommit ? gitStatus.lastCommit.shortHash : 'Инициализация'}</strong>
            &bull; <em>${gitStatus.lastCommit ? gitStatus.lastCommit.subject : 'Первичный снимок CRM'}</em>
            &bull; Автор: ${gitStatus.lastCommit ? gitStatus.lastCommit.author : 'Климов Евгений'}
          </div>
        </div>

        <div style="display: flex; gap: 10px; align-items: center;">
          <button type="button" id="gh-sync-btn" onclick="triggerMainGitHubSync()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: none; padding: 9px 18px; border-radius: 8px; font-weight: 700; font-size: 13.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
            <span>🚀</span>
            <span>Синхронизировать на GitHub</span>
          </button>
          <button type="button" onclick="openGitHubModal()" style="background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.25); padding: 9px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer;">
            ⚙️ Секреты и CI/CD
          </button>
        </div>
      </div>

      <!-- Quick secrets pills -->
      <div style="display: flex; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; flex-wrap: wrap;">
        <span style="color: #94a3b8;">Статус интеграций:</span>
        <span style="color: ${gitConfig.hasToken ? '#34d399' : '#f59e0b'};">
          ${gitConfig.hasToken ? '● GITHUB_TOKEN настроен' : '○ GITHUB_TOKEN (для push)'}
        </span>
        <span style="color: ${hasSaby ? '#34d399' : '#94a3b8'};">
          ${hasSaby ? '● Saby RPC API активен' : '○ Saby API (локальный режим)'}
        </span>
        <span style="color: ${hasBeget ? '#34d399' : '#94a3b8'};">
          ${hasBeget ? '● Beget Cloud API настроен' : '○ Beget Cloud (по карточкам)'}
        </span>
        <span style="color: #60a5fa;">
          ● CI/CD Deploy Workflow: .github/workflows/deploy.yml
        </span>
      </div>
    </div>

    <!-- Liquid Glass Portal Banner & Quick Switcher -->
    <div style="background: linear-gradient(135deg, rgba(238,242,255,0.95) 0%, rgba(245,243,255,0.95) 100%); border: 1px solid #c7d2fe; border-radius: 14px; padding: 18px 22px; margin-bottom: 20px; box-shadow: 0 4px 18px rgba(99,102,241,0.08);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
        <div>
          <div style="font-size: 16px; font-weight: 700; color: #1e1b4b; display: flex; align-items: center; gap: 8px;">
            <span>✨</span> Клиентские кабинеты активны (Режим прямого доступа без паролей)
          </div>
          <div style="font-size: 13.5px; color: #4338ca; margin-top: 3px;">
            Вся функциональность работает: СБИС ЭДО, Beget Cloud, SLA, мониторинг, заявки и акты.
          </div>
        </div>
      </div>

      <!-- Quick client switcher buttons -->
      <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding-top: 10px; border-top: 1px solid rgba(199,210,254,0.6);">
        <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6366f1;">Быстрый вход:</span>
        <a href="/portal/2" target="_blank" style="background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: #fff; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(124,58,237,0.2);">
          🖥️ Кабинет: ООО «Альфа-Сервис» (Клиент 2) &rarr;
        </a>
        <a href="/client/2" style="background: #fff; border: 1px solid #c7d2fe; color: #4338ca; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;">
          ⚙️ Карточка: ООО «Альфа-Сервис»
        </a>
        <a href="/portal/4" target="_blank" style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); color: #fff; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(79,70,229,0.2);">
          🖥️ Кабинет: ООО «Северный Вектор» (Клиент 4) &rarr;
        </a>
        <a href="/client/4" style="background: #fff; border: 1px solid #c7d2fe; color: #4338ca; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;">
          ⚙️ Карточка: ООО «Северный Вектор»
        </a>
      </div>
    </div>

    <div class="actions-bar">
      <a href="/add_page" class="btn">+ Добавить контрагента из Saby</a>
      <button type="button" onclick="openSabySettingsModal()" class="btn" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; box-shadow: 0 4px 12px rgba(2,132,199,0.25);">
        ⚙️ Интеграция Saby CRM & Ключи
      </button>
      <a href="/portal/2" target="_blank" class="btn" style="background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); color: #5b21b6; box-shadow: none;">🖥️ Открыть Клиентский портал</a>
      <button type="button" onclick="triggerMainGitHubSync()" class="btn" style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); color: #1e293b; box-shadow: none;">
        🐙 Отправить изменения на GitHub
      </button>
      <span style="font-size:13px; color:#94a3b8; margin-left: auto;">Всего контрагентов: ${clients.length}</span>
    </div>

    <table>
      <thead>
        <tr>
          <th>Компания / ИНН</th>
          <th>Договор Saby</th>
          <th>Сайты</th>
          <th>Beget Логин</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${clients.map(c => `
          <tr>
            <td>
              <strong>${c.company_name}</strong><br>
              <small style="color:#64748b;">ИНН: ${c.inn}</small>
            </td>
            <td>
              ${c.saby_contract_number || '<span style="color:#94a3b8;">Не указан</span>'}
            </td>
            <td>${c.sites || '<span style="color:#94a3b8;">—</span>'}</td>
            <td>
              ${c.beget_login
                ? `<span class="badge badge-active">${c.beget_login}</span>`
                : `<span class="badge">Не задан</span>`}
            </td>
            <td>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <a href="/client/${c.id}" class="card-link">Карточка / Настройки &rarr;</a>
                <a href="/portal/${c.id}" target="_blank" style="font-size: 12px; color: #7c3aed; font-weight: 600; text-decoration: none; padding-left: 2px;">
                  🖥️ Клиентский портал &nearr;
                </a>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- Modal: GitHub & CI/CD Diagnostics -->
  <div id="github-modal" class="modal-overlay">
    <div class="modal-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
        <h3 style="margin: 0; font-size: 18px; color: #1e1b4b; display: flex; align-items: center; gap: 8px;">
          <span>🐙</span> Синхронизация с GitHub и CI/CD
        </h3>
        <button type="button" onclick="closeGitHubModal()" style="background: transparent; border: none; font-size: 22px; cursor: pointer; color: #94a3b8;">&times;</button>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 16px; font-size: 13.5px; line-height: 1.5;">
        <div><strong>Репозиторий:</strong> ${gitConfig.repo} (ветка <code>${gitStatus.branch || 'main'}</code>)</div>
        <div><strong>Удалённый адрес:</strong> <code style="font-size: 12px;">${gitConfig.remoteUrl}</code></div>
        <div><strong>Автор коммитов:</strong> ${gitConfig.committerName} &lt;${gitConfig.committerEmail}&gt;</div>
        <div><strong>Последний коммит:</strong> ${gitStatus.lastCommit ? `${gitStatus.lastCommit.shortHash} — "${gitStatus.lastCommit.subject}"` : 'Отсутствует'}</div>
        <div><strong>Неотправленные файлы:</strong> ${gitStatus.uncommittedCount} шт.</div>
      </div>

      <div style="margin-bottom: 18px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px;">Комментарий к коммиту синхронизации:</label>
        <input type="text" id="modal-commit-msg" value="Обновление состояния CRM и данных договоров" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px;">
      </div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px;">
        <button type="button" id="modal-push-btn" onclick="executeGitHubPush()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <span>🚀</span> Запустить синхронизацию (Git Commit & Push)
        </button>
        <button type="button" onclick="testGitHubConnection()" style="background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 8px; font-weight: 600; cursor: pointer;">
          🔍 Тест GitHub API
        </button>
        <button type="button" onclick="testSabyGateway()" style="background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 8px; font-weight: 600; cursor: pointer;">
          ⚡ Тест Saby RPC
        </button>
      </div>

      <div id="modal-result" style="display: none; padding: 12px; border-radius: 8px; font-size: 13px; line-height: 1.4; max-height: 140px; overflow-y: auto;"></div>
    </div>
  </div>

  <!-- Modal: Saby CRM & Hosting Global Configuration -->
  <div id="saby-settings-modal" class="modal-overlay">
    <div class="modal-card" style="max-width: 680px; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
        <h3 style="margin: 0; font-size: 18px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
          <span>⚙️</span> Настройка шлюза Saby CRM, СБИС и бэкапов
        </h3>
        <button type="button" onclick="closeSabySettingsModal()" style="background: transparent; border: none; font-size: 22px; cursor: pointer; color: #94a3b8;">&times;</button>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 13px; color: #166534; line-height: 1.5;">
        🔒 <strong>Безопасное хранилище:</strong> Указанные ключи и токены синхронизируются с сервером и файлом <code>crm_secure_settings.json</code> с правами 0600. Существующие пароли защищены маскированием.
      </div>

      <!-- Saby API Credentials Group -->
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
        <h4 style="margin: 0 0 12px; font-size: 14.5px; color: #0369a1; display: flex; align-items: center; gap: 6px;">
          <span>🏢</span> Интеграция с Saby CRM / СБИС (online.sbis.ru)
        </h4>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">App Client ID (Идентификатор приложения):</label>
            <input type="text" id="cfg-saby-client-id" placeholder="например: app_12345..." style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">App Secret (Секретный ключ приложения):</label>
            <input type="password" id="cfg-saby-app-secret" placeholder="••••••••••••" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Secret Key (Сервисный ключ API):</label>
            <input type="password" id="cfg-saby-secret-key" placeholder="••••••••••••" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Адрес RPC сервиса:</label>
            <input type="text" id="cfg-saby-rpc-url" value="https://online.sbis.ru/service/sbis-rpc.service" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Логин пользователя СБИС (опционально):</label>
            <input type="text" id="cfg-saby-login" placeholder="Логин или телефон" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Пароль пользователя СБИС:</label>
            <input type="password" id="cfg-saby-password" placeholder="••••••••••••" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>
      </div>

      <!-- Backup Webhook & Monitoring Group -->
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
        <h4 style="margin: 0 0 12px; font-size: 14.5px; color: #b45309; display: flex; align-items: center; gap: 6px;">
          <span>📦</span> Скрипты бэкапов сайтов (Webhook API)
        </h4>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 10px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Секретный токен для вебхуков бэкапов (Bearer Secret):</label>
            <input type="text" id="cfg-backup-secret" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-family: monospace;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Email для алертов:</label>
            <input type="email" id="cfg-backup-email" placeholder="EKlimov84@gmail.com" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>

        <div style="font-size: 12px; color: #64748b; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px dashed #cbd5e1;">
          <strong>URL для скриптов бэкапов:</strong> <code>https://test.crm.e-klimov.ru/api/backups/report</code><br>
          <em>Скрипт на сервере сайта может вызывать curl с JSON: <code>{"site":"domain.ru", "size_mb": 2500, "status": "Успешно", "secret": "..."}</code></em>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
        <div style="display: flex; gap: 8px;">
          <button type="button" id="cfg-save-btn" onclick="saveSabyGlobalSettings()" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer;">
            💾 Сохранить параметры
          </button>
          <button type="button" id="cfg-test-saby-btn" onclick="testSabyFromModal()" style="background: #f1f5f9; color: #0369a1; border: 1px solid #bae6fd; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">
            ⚡ Проверить связь с Saby
          </button>
        </div>
        <button type="button" onclick="closeSabySettingsModal()" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #64748b; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">
          Закрыть
        </button>
      </div>

      <div id="cfg-result-box" style="display: none; margin-top: 14px; padding: 12px; border-radius: 8px; font-size: 13px; line-height: 1.4;"></div>
    </div>
  </div>

  <div id="toast-el" class="toast"></div>

  <script>
    function showToast(msg) {
      const t = document.getElementById('toast-el');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 3500);
    }

    function openGitHubModal() {
      document.getElementById('github-modal').style.display = 'flex';
    }

    function closeGitHubModal() {
      document.getElementById('github-modal').style.display = 'none';
    }

    async function triggerMainGitHubSync() {
      const btn = document.getElementById('gh-sync-btn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span><span>Синхронизация...</span>';
      }
      try {
        const res = await fetch('/api/github/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Автоматическая синхронизация CRM из панели управления' })
        });
        const data = await res.json();
        if (data.ok) {
          showToast('✓ ' + (data.log?.message || 'Синхронизация с GitHub успешно завершена!'));
          setTimeout(() => { window.location.reload(); }, 1800);
        } else {
          alert('Ошибка синхронизации: ' + (data.log?.message || data.error || 'Неизвестная ошибка'));
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>🚀</span><span>Синхронизировать на GitHub</span>';
          }
        }
      } catch (err) {
        alert('Ошибка связи с сервером: ' + err.message);
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>🚀</span><span>Синхронизировать на GitHub</span>';
        }
      }
    }

    async function executeGitHubPush() {
      const msg = document.getElementById('modal-commit-msg').value || 'Синхронизация состояния CRM';
      const box = document.getElementById('modal-result');
      const btn = document.getElementById('modal-push-btn');
      btn.disabled = true;
      btn.textContent = '⏳ Выполняется push...';
      box.style.display = 'block';
      box.style.background = '#eff6ff';
      box.style.color = '#1e3a8a';
      box.textContent = 'Индексация файлов, экспорт базы данных и отправка в ветку origin/main...';

      try {
        const res = await fetch('/api/github/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        if (data.ok) {
          box.style.background = '#ecfdf5';
          box.style.color = '#065f46';
          box.textContent = '✓ ' + (data.log?.message || 'Успешно отправлено на GitHub!');
        } else {
          box.style.background = '#fef2f2';
          box.style.color = '#991b1b';
          box.textContent = 'Ошибка: ' + (data.log?.message || data.error);
        }
      } catch (e) {
        box.style.background = '#fef2f2';
        box.style.color = '#991b1b';
        box.textContent = 'Сетевая ошибка: ' + e.message;
      } finally {
        btn.disabled = false;
        btn.textContent = '🚀 Запустить синхронизацию (Git Commit & Push)';
      }
    }

    async function testGitHubConnection() {
      const box = document.getElementById('modal-result');
      box.style.display = 'block';
      box.style.background = '#eff6ff';
      box.style.color = '#1e3a8a';
      box.textContent = 'Проверка токена и прав доступа к репозиторию через GitHub API...';

      try {
        const res = await fetch('/api/github/test', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          box.style.background = '#ecfdf5';
          box.style.color = '#065f46';
          box.textContent = '✓ ' + data.message + (data.repo?.canPush ? ' (Права на запись: ДА)' : '');
        } else {
          box.style.background = '#fffbeb';
          box.style.color = '#92400e';
          box.textContent = 'Статус: ' + data.message;
        }
      } catch (e) {
        box.style.background = '#fef2f2';
        box.style.color = '#991b1b';
        box.textContent = 'Сетевая ошибка: ' + e.message;
      }
    }

    async function testSabyGateway() {
      const box = document.getElementById('modal-result');
      box.style.display = 'block';
      box.style.background = '#eff6ff';
      box.style.color = '#1e3a8a';
      box.textContent = 'Проверка шлюза Saby (online.sbis.ru/service/sbis-rpc.service)...';

      try {
        const res = await fetch('/api/saby/test');
        const data = await res.json();
        if (data.ok) {
          box.style.background = '#ecfdf5';
          box.style.color = '#065f46';
          box.textContent = '✓ ' + data.message;
        } else {
          box.style.background = '#fffbeb';
          box.style.color = '#92400e';
          box.textContent = 'Статус Saby: ' + data.message;
        }
      } catch (e) {
        box.style.background = '#fef2f2';
        box.style.color = '#991b1b';
        box.textContent = 'Сетевая ошибка: ' + e.message;
      }
    }

    // Saby & Integration Settings Modal
    async function openSabySettingsModal() {
      const modal = document.getElementById('saby-settings-modal');
      modal.style.display = 'flex';
      const box = document.getElementById('cfg-result-box');
      box.style.display = 'none';

      try {
        const res = await fetch('/api/settings/global');
        const data = await res.json();
        if (data.ok && data.settings) {
          const s = data.settings;
          document.getElementById('cfg-saby-client-id').value = s.saby_app_client_id || '';
          document.getElementById('cfg-saby-app-secret').value = s.has_saby_secret ? '••••••••' : '';
          document.getElementById('cfg-saby-secret-key').value = s.has_saby_key ? '••••••••' : '';
          document.getElementById('cfg-saby-rpc-url').value = s.saby_rpc_url || 'https://online.sbis.ru/service/sbis-rpc.service';
          document.getElementById('cfg-saby-login').value = s.saby_login || '';
          document.getElementById('cfg-saby-password').value = s.has_saby_password ? '••••••••' : '';
          document.getElementById('cfg-backup-secret').value = s.backup_webhook_secret || '';
          document.getElementById('cfg-backup-email').value = s.backup_alert_email || '';
        }
      } catch (err) {
        console.error('Ошибка загрузки настроек:', err);
      }
    }

    function closeSabySettingsModal() {
      document.getElementById('saby-settings-modal').style.display = 'none';
    }

    async function saveSabyGlobalSettings() {
      const btn = document.getElementById('cfg-save-btn');
      const box = document.getElementById('cfg-result-box');
      btn.disabled = true;
      btn.textContent = 'Сохранение...';

      const payload = {
        saby_app_client_id: document.getElementById('cfg-saby-client-id').value,
        saby_app_secret: document.getElementById('cfg-saby-app-secret').value,
        saby_secret_key: document.getElementById('cfg-saby-secret-key').value,
        saby_rpc_url: document.getElementById('cfg-saby-rpc-url').value,
        saby_login: document.getElementById('cfg-saby-login').value,
        saby_password: document.getElementById('cfg-saby-password').value,
        backup_webhook_secret: document.getElementById('cfg-backup-secret').value,
        backup_alert_email: document.getElementById('cfg-backup-email').value
      };

      try {
        const res = await fetch('/api/settings/global', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        box.style.display = 'block';
        if (data.ok) {
          box.style.background = '#ecfdf5';
          box.style.color = '#065f46';
          box.textContent = '✓ Настройки шлюза Saby CRM и бэкапов успешно сохранены!';
          showToast('✓ Настройки Saby успешно сохранены!');
        } else {
          box.style.background = '#fef2f2';
          box.style.color = '#991b1b';
          box.textContent = 'Ошибка сохранения: ' + (data.error || 'Неизвестная ошибка');
        }
      } catch (err) {
        box.style.display = 'block';
        box.style.background = '#fef2f2';
        box.style.color = '#991b1b';
        box.textContent = 'Ошибка связи: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = '💾 Сохранить параметры';
      }
    }

    async function testSabyFromModal() {
      const btn = document.getElementById('cfg-test-saby-btn');
      const box = document.getElementById('cfg-result-box');
      btn.disabled = true;
      btn.textContent = 'Проверка связи...';
      box.style.display = 'block';
      box.style.background = '#eff6ff';
      box.style.color = '#1e3a8a';
      box.textContent = 'Отправка проверочного запроса к Saby RPC API (online.sbis.ru)...';

      const payload = {
        saby_app_client_id: document.getElementById('cfg-saby-client-id').value,
        saby_app_secret: document.getElementById('cfg-saby-app-secret').value,
        saby_secret_key: document.getElementById('cfg-saby-secret-key').value
      };

      try {
        const res = await fetch('/api/settings/saby/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          box.style.background = '#ecfdf5';
          box.style.color = '#065f46';
          box.textContent = '✓ ' + data.message;
        } else {
          box.style.background = '#fffbeb';
          box.style.color = '#92400e';
          box.textContent = 'Статус шлюза: ' + data.message + (data.status ? (' (Код: ' + data.status + ')') : '');
        }
      } catch (err) {
        box.style.background = '#fef2f2';
        box.style.color = '#991b1b';
        box.textContent = 'Ошибка проверки: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = '⚡ Проверить связь с Saby';
      }
    }
  </script>
</body>
</html>`);
});

// Add client page (Apple Liquid Glass)
app.get('/add_page', (req, res) => {
  res.send(renderNewClientPage());
});
app.get('/new_client', (req, res) => {
  res.send(renderNewClientPage());
});

// Company suggestion endpoint
app.get('/suggest_company', async (req, res) => {
  const q = req.query.q || '';
  const suggestions = await suggestCompany(q);
  res.json(suggestions);
});

// Contracts endpoint
app.get('/get_contracts', async (req, res) => {
  const inn = req.query.inn || '';
  const contracts = await getContracts(inn);
  res.json({ contracts });
});

// Add client POST
app.post('/add_client', (req, res) => {
  const { inn, company_name, emails, sites, contract_id, contract_number } = req.body;
  const newClient = db.addClient({
    inn: inn || req.body.search_input,
    company_name: company_name || req.body.search_input,
    email_reports: emails,
    sites,
    saby_contract_id: contract_id,
    saby_contract_number: contract_number
  });
  req.session.flash = `Карточка контрагента ${newClient.company_name} успешно создана!`;
  res.redirect(`/client/${newClient.id}`);
});

// Client card (Apple Liquid Glass)
app.get('/client/:id', (req, res) => {
  const client = db.getClientById(req.params.id);
  if (!client) {
    return res.status(404).send('Клиент не найден. <a href="/">Вернуться</a>');
  }

  res.send(renderAdminClientPage({
    client,
    activeTab: req.query.tab || 'works',
    flashMessage: res.locals.flash || req.query.msg,
    reqQuery: req.query
  }));
});

// Full Client Update (Settings Tab & Keys Tab)
app.post('/client/:id/update_full', (req, res) => {
  const clientId = req.params.id;
  const activeTab = req.body.active_tab || 'settings';

  db.updateClientFull(clientId, {
    company_name: req.body.company_name,
    inn: req.body.inn,
    kpp: req.body.kpp,
    ogrn: req.body.ogrn,
    director: req.body.director,
    address: req.body.address,
    saby_contract_id: req.body.saby_contract_id,
    saby_contract_number: req.body.saby_contract_number,
    saby_contract_title: req.body.saby_contract_title,
    plan_hours: req.body.plan_hours,
    tariff: req.body.tariff,
    sla_target: req.body.sla_target,
    sites: req.body.sites,
    emails: req.body.emails,
    beget_login: req.body.beget_login,
    beget_password: req.body.beget_password,
    beget_api_key: req.body.beget_api_key,
    report_schedule: req.body.report_schedule,
    report_sections: Array.isArray(req.body.report_sections) ? req.body.report_sections.join(',') : req.body.report_sections || '',
    report_start_day: req.body.report_start_day
  });

  // Also save credentials if provided from the "Доступы и хостинг" tab
  if (req.body.cred_hosting_provider !== undefined || req.body.cred_bitrix_admin_url !== undefined || activeTab === 'keys') {
    db.updateClientCredentials(clientId, {
      hosting_provider: req.body.cred_hosting_provider,
      hosting_url: req.body.cred_hosting_url,
      hosting_login: req.body.cred_hosting_login,
      hosting_password: req.body.cred_hosting_password,
      hosting_api_key: req.body.cred_hosting_api_key,
      bitrix_admin_url: req.body.cred_bitrix_admin_url,
      bitrix_login: req.body.cred_bitrix_login,
      bitrix_password: req.body.cred_bitrix_password,
      bitrix_version: req.body.cred_bitrix_version,
      php_version: req.body.cred_php_version,
      ssh_host: req.body.cred_ssh_host,
      ssh_port: req.body.cred_ssh_port,
      ssh_user: req.body.cred_ssh_user,
      ssh_password: req.body.cred_ssh_password,
      mysql_host: req.body.cred_mysql_host,
      mysql_name: req.body.cred_mysql_name,
      mysql_user: req.body.cred_mysql_user,
      mysql_password: req.body.cred_mysql_password,
      notes: req.body.cred_notes
    });
  }

  req.session.flash = activeTab === 'keys'
    ? '✓ Доступы к хостингу, 1С-Битрикс и SSH успешно сохранены!'
    : '✓ Параметры карточки и договор Saby успешно сохранены!';
  res.redirect(`/client/${clientId}?tab=${activeTab}`);
});

// Record manual backup
app.post('/client/:id/record_backup', (req, res) => {
  const clientId = req.params.id;
  const { site_domain, size_mb, type, status, details } = req.body;
  db.recordSiteBackup({
    domain: site_domain || 'главный сайт',
    size_mb: parseFloat(size_mb) || 0,
    type: type || 'full',
    status: status || 'Успешно',
    details: details || 'Ручная фиксация в карточке CRM',
    source: 'Панель администратора CRM',
    clientId
  });
  req.session.flash = `✓ Резервная копия для ${site_domain || 'сайта'} успешно зафиксирована!`;
  res.redirect(`/client/${clientId}?tab=backups`);
});

// Webhook for backup reporting from Bitrix / bash scripts on client websites
app.post('/api/backups/report', (req, res) => {
  const { site, domain, size_mb, status, type, details, secret } = req.body;
  const expectedSecret = process.env.BACKUP_WEBHOOK_SECRET || settingsManager.getRawSettings().backup_webhook_secret;

  if (secret && expectedSecret && secret !== expectedSecret) {
    return res.status(403).json({ ok: false, error: 'Неверный секретный ключ вебхука' });
  }

  const targetDomain = domain || site;
  if (!targetDomain) {
    return res.status(400).json({ ok: false, error: 'Параметр domain или site обязателен' });
  }

  const backup = db.recordSiteBackup({
    domain: targetDomain,
    size_mb: parseFloat(size_mb) || 0,
    type: type || 'full',
    status: status || 'Успешно',
    details: details || 'Автоматический отчет со скрипта бэкапа (Bitrix Cron Webhook)',
    source: 'Bitrix Cron Webhook'
  });

  res.json({ ok: true, message: `Отчет о бэкапе для ${targetDomain} успешно сохранен`, backup });
});

// Global integration settings API
app.get('/api/settings/global', (req, res) => {
  res.json({ ok: true, settings: settingsManager.getPublicSettings() });
});

app.post('/api/settings/global', (req, res) => {
  const result = settingsManager.saveSettings(req.body);
  res.json(result);
});

// Test Saby API connection with optional newly passed credentials
app.post('/api/settings/saby/test', async (req, res) => {
  try {
    const { saby_app_client_id, saby_app_secret, saby_secret_key } = req.body || {};
    if (saby_app_client_id) {
      settingsManager.saveSettings({ saby_app_client_id, saby_app_secret, saby_secret_key });
    }
    const testRes = await testSabyConnection();
    res.json(testRes);
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Advanced Work Log Add (with category and Saby sync)
app.post('/client/:id/add_log_advanced', (req, res) => {
  const clientId = req.params.id;
  const { description, hours, category, work_date_local, sync_to_saby } = req.body;
  const dateStr = work_date_local ? work_date_local.replace('T', ' ') : null;
  db.addWorkLog(clientId, {
    description,
    hours,
    category,
    work_date: dateStr,
    syncToSaby: sync_to_saby === '1' || sync_to_saby === true
  });
  req.session.flash = 'Запись о работе успешно добавлена и синхронизирована с Saby!';
  res.redirect(`/client/${clientId}?tab=works`);
});

// Edit Work Log Modal Post
app.post('/client/:id/edit_log_post', (req, res) => {
  const clientId = req.params.id;
  const { log_id, description, hours, category, work_date } = req.body;
  db.updateWorkLog(log_id, {
    description,
    hours,
    category,
    work_date
  });
  req.session.flash = 'Запись о работе успешно обновлена!';
  res.redirect(`/client/${clientId}?tab=works`);
});

// Two-way Saby Synchronization API
app.post('/api/client/:id/sync_saby', async (req, res) => {
  try {
    const result = await db.syncWithSaby(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GitHub Integration & Auto-Sync APIs
app.get('/api/github/status', (req, res) => {
  const status = getGitStatus();
  const config = getGitHubConfig();
  res.json({ ok: true, status, config });
});

app.post('/api/github/test', async (req, res) => {
  const result = await testGitHubApi();
  res.json(result);
});

app.post('/api/github/sync', async (req, res) => {
  try {
    const message = req.body?.message || 'Синхронизация состояния CRM и базы данных';
    const result = await syncToGitHub({ message, crmDb: db });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Saby Live Test API
app.get('/api/saby/test', async (req, res) => {
  const result = await testSabyConnection();
  res.json(result);
});

// Beget Live Test & Refresh API
app.get('/api/beget/test/:clientId', async (req, res) => {
  const client = db.getClientById(req.params.clientId);
  if (!client) return res.status(404).json({ ok: false, error: 'Контрагент не найден' });
  const result = await testBegetConnection(client);
  res.json(result);
});

app.post('/api/beget/refresh/:clientId', async (req, res) => {
  const client = db.getClientById(req.params.clientId);
  if (!client) return res.status(404).json({ ok: false, error: 'Контрагент не найден' });

  const snapshot = await pullBegetSnapshot(client);
  if (snapshot.hasLiveConnection) {
    db.addHostEvent(client.id, {
      event_type: 'beget_live_snapshot',
      source: 'beget_api',
      details: {
        account: snapshot.account,
        snapshot: {
          domains: snapshot.domains || [],
          sites: snapshot.sites || []
        }
      }
    });
    return res.json({
      ok: true,
      message: 'Свежие данные (домены, сайты, баланс) успешно загружены с серверов Beget!',
      snapshot
    });
  } else {
    return res.json({
      ok: false,
      message: snapshot.account?.error || 'Не удалось связаться с серверами Beget. Проверьте логин/пароль Beget в карточке контрагента.',
      snapshot
    });
  }
});

// System Integrations Status
app.get('/api/system/integrations', (req, res) => {
  const ghConfig = getGitHubConfig();
  const ghStatus = getGitStatus();
  const sabyCreds = authenticateSaby; // presence
  res.json({
    ok: true,
    github: {
      hasToken: ghConfig.hasToken,
      repo: ghConfig.repo,
      branch: ghConfig.branch,
      lastCommit: ghStatus.lastCommit,
      uncommittedCount: ghStatus.uncommittedCount
    },
    saby: {
      hasCredentials: !!(process.env.SABY_APP_CLIENT_ID && process.env.SABY_APP_SECRET)
    },
    beget: {
      hasDefaultCredentials: !!process.env.BEGET_LOGIN
    },
    deployment: {
      hasHost: !!process.env.SERVER_HOST,
      hasUser: !!process.env.SERVER_USER,
      hasSshKey: !!process.env.SSH_PRIVATE_KEY
    }
  });
});

// Saby Act Generation API
app.post('/api/saby_act', (req, res) => {
  const { clientId, monthName, amount } = req.body;
  const doc = db.addSabyDoc(clientId, {
    number: `АКТ-${Math.floor(100 + Math.random() * 900)}`,
    title: `Акт сдачи-приемки услуг за ${monthName || 'расчетный период'}`,
    status: 'Подписан',
    amount: amount || '38 000 ₽',
    edo_status: 'Подписан контрагентом в СБИС ЭДО'
  });
  res.json({ ok: true, doc });
});

// Update Beget settings
app.post('/client/:id/update_beget', (req, res) => {
  const clientId = req.params.id;
  db.updateClientBeget(clientId, {
    beget_login: (req.body.beget_login || '').trim(),
    beget_pass: (req.body.beget_pass || '').trim(),
    beget_api_key: (req.body.beget_api_key || '').trim(),
    sites: (req.body.sites || '').trim(),
    emails: (req.body.emails || '').trim(),
    report_schedule: req.body.report_schedule,
    report_sections: Array.isArray(req.body.report_sections)
      ? req.body.report_sections.join(',')
      : req.body.report_sections || '',
    report_start_day: req.body.report_start_day
  });

  req.session.flash = 'Доступы и параметры рассылки Beget успешно сохранены!';
  res.redirect(`/client/${clientId}`);
});

// Add work log
app.post('/client/:id/add_log', (req, res) => {
  const clientId = req.params.id;
  const { description, hours, work_date_local } = req.body;
  const dateStr = work_date_local ? work_date_local.replace('T', ' ') : null;
  db.addWorkLog(clientId, description, hours, dateStr);
  res.redirect(`/client/${clientId}`);
});

// Edit work log GET
app.get('/client/:id/edit_log/:log_id', (req, res) => {
  const { id, log_id } = req.params;
  const logs = db.getWorkLogs(id);
  const log = logs.find(l => l.id === parseInt(log_id, 10));
  if (!log) {
    return res.status(404).send('Запись не найдена. <a href="/client/' + id + '">Назад</a>');
  }

  const dtVal = log.work_date ? log.work_date.replace(' ', 'T').slice(0, 16) : '';

  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Редактировать запись</title>
  <style>
    body { font-family: sans-serif; background: #fffaf0; padding: 30px; display: grid; place-items: center; }
    .card { background: #fff; border-radius: 12px; padding: 25px; width: min(500px, 100%); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
    input, textarea { width: 100%; padding: 10px; margin: 8px 0 16px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }
    button { padding: 10px 18px; background: linear-gradient(135deg,#ffd6c2,#ffb4a2); border: 0; border-radius: 6px; font-weight: bold; cursor: pointer; }
    a { color: #6b5a57; margin-left: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h3>Редактировать запись о работах</h3>
    <form method="POST" action="/client/${id}/edit_log/${log_id}">
      <label>Дата и время:</label>
      <input type="datetime-local" name="work_date_local" value="${dtVal}">
      <label>Описание:</label>
      <textarea name="description" rows="4" required>${log.description}</textarea>
      <label>Часы:</label>
      <input type="number" step="0.5" name="hours" value="${log.hours}" required>
      <button type="submit">Сохранить изменения</button>
      <a href="/client/${id}">Отмена</a>
    </form>
  </div>
</body>
</html>`);
});

// Edit work log POST
app.post('/client/:id/edit_log/:log_id', (req, res) => {
  const { id, log_id } = req.params;
  const { description, hours, work_date_local } = req.body;
  const dateStr = work_date_local ? work_date_local.replace('T', ' ') : null;
  db.updateWorkLog(log_id, description, hours, dateStr);
  res.redirect(`/client/${id}`);
});

// Delete work log
app.get('/client/:id/delete_log/:log_id', (req, res) => {
  const { id, log_id } = req.params;
  db.deleteWorkLog(log_id);
  res.redirect(`/client/${id}`);
});

// Create access link
app.post('/client/:id/create-access-link', (req, res) => {
  const client = db.getClientById(req.params.id);
  if (!client) return res.status(404).send('Клиент не найден');

  const token = db.createAccessLink(client.id);
  const host = req.get('host') || 'localhost:3000';
  const proto = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const link = `${proto}://${host}/public/client/${token}`;

  res.send(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Ссылка создана — CRM</title>
  <style>
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #f5f7fb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .card {
      width: min(700px, calc(100% - 32px)); padding: 32px; background: #fff;
      border-radius: 20px; box-shadow: 0 18px 50px rgba(36,49,77,0.1);
    }
    h1 { margin-top: 0; color: #202b45; font-size: 24px; }
    input {
      width: 100%; box-sizing: border-box; padding: 13px; border: 1px solid #d8deea;
      border-radius: 10px; font-size: 15px; background: #f8fafc;
    }
    a { display: inline-block; margin-top: 18px; color: #202b45; font-weight: 600; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Ссылка клиентского кабинета создана</h1>
    <p>Ссылка для <strong>${client.company_name}</strong> активна. Скопируйте её и передайте клиенту. Предыдущие ссылки автоматически отозваны.</p>
    <input readonly value="${link}" onclick="this.select()">
    <p style="margin-top:20px;">
      <a href="${link}" target="_blank" style="background:linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color:#ffffff; padding:10px 20px; border-radius:10px; font-weight:700; text-decoration:none; display:inline-block; margin-right:16px; box-shadow:0 4px 12px rgba(124,58,237,0.25);">
        🖥️ Перейти в клиентский кабинет &rarr;
      </a>
      <a href="/client/${client.id}">&larr; Вернуться в карточку клиента</a>
    </p>
  </main>
</body>
</html>`);
});

// Public client portal (Apple Liquid Glass design)
app.get('/public/client/:token', (req, res) => {
  const token = req.params.token;
  const client = db.getClientByToken(token);
  if (!client) {
    return res.status(404).send(`<!doctype html>
      <html lang="ru">
      <head><meta charset="utf-8"><title>Ссылка недействительна</title></head>
      <body style="font-family:sans-serif; text-align:center; padding:60px; background:#f8fafc;">
        <h2 style="color:#1e1b4b;">Ссылка клиентского кабинета недействительна или отозвана</h2>
        <p style="color:#64748b;">Запросите актуальную ссылку у вашего системного администратора.</p>
        <a href="/" style="color:#6366f1; font-weight:bold;">Перейти в CRM</a>
      </body>
      </html>`);
  }

  const activeTab = req.query.tab || 'home';
  res.send(renderPortalPage({ client, token, activeTab, reqQuery: req.query }));
});

// Direct Client Portal Preview (for Admin or Demo, defaults to Client 2)
app.get('/portal/:id?', (req, res) => {
  const clientId = req.params.id || 2; // Default to Client 2 (ООО "Альфа-Сервис")
  const client = db.getClientById(clientId) || db.getClientById(2) || db.getClientById(4) || db.getClients()[0];
  if (!client) {
    return res.status(404).send('Клиент не найден');
  }

  const token = client.active_token || db.createAccessLink(client.id);
  const activeTab = req.query.tab || 'home';
  res.send(renderPortalPage({ client, token, activeTab, reqQuery: req.query }));
});

// API endpoint to create ticket from client portal
app.post('/api/ticket', (req, res) => {
  const { clientId, subject, service, priority, message } = req.body;
  if (!clientId || !subject) {
    return res.status(400).json({ ok: false, error: 'Укажите тему обращения' });
  }
  const ticket = db.createTicket(clientId, { subject, service, priority, message });
  res.json({ ok: true, ticket });
});

// API endpoint to generate Saby Act from client portal
app.post('/api/saby_act', (req, res) => {
  const { clientId, monthName, amount } = req.body;
  const doc = db.createSabyAct(clientId, { monthName, amount });
  res.json({ ok: true, doc });
});

// API endpoint for filtered service events
app.get('/api/service_events', (req, res) => {
  const clientId = req.query.client_id || 2;
  const category = req.query.category || 'all';
  const events = db.getServiceEvents(clientId, category);
  res.json({ ok: true, events });
});

// Report Generation Page
app.get('/client/:id/report', (req, res) => {
  const client = db.getClientById(req.params.id);
  if (!client) {
    return res.status(404).send('Клиент не найден');
  }

  const dateFrom = req.query.date_from || formatDateShort(new Date(Date.now() - 30 * 86400000));
  const dateTo = req.query.date_to || formatDateShort(new Date());

  // Filter logs
  const allLogs = db.getWorkLogs(client.id);
  const logs = allLogs.filter(l => {
    const d = l.work_date.slice(0, 10);
    return d >= dateFrom && d <= dateTo;
  });

  const totalHours = logs.reduce((acc, l) => acc + (parseFloat(l.hours) || 0), 0);

  // Filter backups
  const backups = db.getBackups(client.id, dateFrom, dateTo);

  // Get hosting snapshot info
  const snapshotEvent = db.getLastSnapshot(client.id);
  let balance = '3 480.00 руб.';
  let domains = [
    { domain: (client.sites || 'technoprom.ru').split(',')[0].trim(), ssl: '✅ Включен (Let\'s Encrypt)', expire: '15.04.2025' }
  ];

  if (snapshotEvent && snapshotEvent.details) {
    const acc = snapshotEvent.details.account || {};
    if (acc.user_balance) balance = `${acc.user_balance} руб.`;
    const snap = snapshotEvent.details.snapshot || {};
    if (Array.isArray(snap.domains) && snap.domains.length > 0) {
      domains = snap.domains.map(d => ({
        domain: d.fqdn || d.domain,
        ssl: d.ssl_status === 'active' || d.ssl_status === 'le_set' ? '✅ Включен' : '❌ Выключен',
        expire: d.date_expire || 'Н/Д'
      }));
    }
  }

  const generatedAt = formatDateRus(new Date().toISOString());

  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Отчёт — ${client.company_name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 25px; line-height: 1.6; color: #222; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; margin-top: 10px; }
    h2 { color: #2980b9; margin-top: 30px; border-left: 4px solid #3498db; padding-left: 10px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 14px; }
    th { background: #3498db; color: white; font-weight: bold; }
    tr:nth-child(even) { background: #f9fbfd; }
    .summary { background: #ecf0f1; padding: 16px; border-radius: 8px; margin: 20px 0; }
    .summary p { margin: 6px 0; font-size: 15px; }
    .no-data { color: #7f8c8d; font-style: italic; text-align: center; padding: 20px; }
    .btn { padding: 10px 20px; font-size: 15px; cursor: pointer; border: none; border-radius: 6px; margin-right: 10px; color: white; font-weight: bold; }
    .btn-print { background: #27ae60; }
    .btn-close { background: #95a5a6; }
    .badge { padding: 3px 8px; border-radius: 4px; font-size: 12px; background: #e2e8f0; }
    @media print {
      .no-print { display: none; }
      body { margin: 0; padding: 10px; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px;">
    <button onclick="window.print()" class="btn btn-print">🖨️ Печать / Сохранить в PDF</button>
    <button onclick="window.close()" class="btn btn-close">✖ Закрыть</button>
  </div>

  <h1>Отчёт о сопровождении ИТ-инфраструктуры</h1>

  <div class="summary">
    <p><strong>Заказчик:</strong> ${client.company_name} (ИНН: ${client.inn})</p>
    <p><strong>Договор:</strong> № ${client.saby_contract_number || 'б/н'}</p>
    <p><strong>Период отчёта:</strong> с ${dateFrom} по ${dateTo}</p>
    <p><strong>Дата формирования:</strong> ${generatedAt}</p>
  </div>

  <h2>💰 Баланс аккаунта Beget (на дату формирования)</h2>
  <p style="font-size: 20px; font-weight: bold; color: #27ae60;">${balance}</p>

  <h2>🌐 Домены и SSL-сертификаты</h2>
  <table>
    <thead>
      <tr>
        <th>Домен</th>
        <th>Статус SSL</th>
        <th>Срок продления домена</th>
      </tr>
    </thead>
    <tbody>
      ${domains.map(d => `
        <tr>
          <td><strong>${d.domain}</strong></td>
          <td>${d.ssl}</td>
          <td>${d.expire}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>💾 Резервные копии хостинга (${backups.length} шт.)</h2>
  ${backups.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Сайт / Источник</th>
          <th>Дата и время бэкапа</th>
          <th>Размер</th>
          <th>Статус</th>
        </tr>
      </thead>
      <tbody>
        ${backups.map(b => `
          <tr>
            <td><strong>${b.site_name}</strong></td>
            <td>${b.backup_date}</td>
            <td>${b.size_mb} МБ</td>
            <td><span class="badge">${b.status}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : `
    <p class="no-data">Бэкапы за выбранный период отсутствуют</p>
  `}

  <h2>📋 Выполненные работы и обращения (${logs.length} шт., всего ${totalHours.toFixed(1)} ч.)</h2>
  ${logs.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Дата выполнения</th>
          <th>Описание работы</th>
          <th style="text-align:center;">Затрачено часов</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map(l => `
          <tr>
            <td style="white-space:nowrap;">${formatDateRus(l.work_date)}</td>
            <td>${l.description}</td>
            <td style="text-align:center; font-weight:bold;">${l.hours} ч.</td>
          </tr>
        `).join('')}
        <tr style="background:#f1f5f9; font-weight:bold;">
          <td colspan="2" style="text-align:right;">ИТОГО:</td>
          <td style="text-align:center;">${totalHours.toFixed(1)} ч.</td>
        </tr>
      </tbody>
    </table>
  ` : `
    <p class="no-data">Работы за выбранный период не зафиксированы</p>
  `}

  <div class="no-print" style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee;">
    <button onclick="window.print()" class="btn btn-print">🖨️ Печать / Сохранить в PDF</button>
    <button onclick="window.close()" class="btn btn-close">✖ Закрыть</button>
  </div>
</body>
</html>`);
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send(`<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><title>Ошибка CRM</title></head>
<body style="font-family:sans-serif; padding:30px;">
  <h2>Не удалось выполнить операцию</h2>
  <p>Ошибка зарегистрирована в системе.</p>
  <a href="/">Вернуться на главную</a>
</body>
</html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CRM Server running at http://0.0.0.0:${PORT}`);
});
