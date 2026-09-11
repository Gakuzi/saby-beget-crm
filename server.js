import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './crm_store.js';
import { checkInnChecksum, suggestCompany, getContracts } from './inn_helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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

// Authentication middleware
function requireAdmin(req, res, next) {
  // Public routes
  if (
    req.path === '/healthz' ||
    req.path === '/login' ||
    req.path === '/logout' ||
    req.path === '/suggest_company' ||
    req.path === '/get_contracts' ||
    req.path.startsWith('/public/')
  ) {
    return next();
  }

  // Report route can be accessed with valid token
  if (req.path.endsWith('/report')) {
    const accessToken = req.query.access_token;
    if (accessToken) {
      const client = db.getClientByToken(accessToken);
      if (client) {
        req.publicClient = client;
        return next();
      }
    }
    const internalHeader = req.headers['x-crm-internal-token'];
    const expectedInternal = process.env.CRM_INTERNAL_TOKEN || '';
    if (expectedInternal && internalHeader === expectedInternal) {
      return next();
    }
  }

  // Admin session check
  if (req.session && req.session.crm_admin_user) {
    return next();
  }

  const nextUrl = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(`/login?next=${nextUrl}`);
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

// Login
app.get('/login', (req, res) => {
  const error = req.query.error || null;
  res.send(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Вход в CRM — Saby & Beget</title>
  <style>
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: linear-gradient(135deg, #fffaf0 0%, #f4f6fa 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #20242c;
    }
    .card {
      width: min(440px, calc(100% - 32px)); padding: 36px;
      border: 1px solid rgba(240, 233, 230, 0.9);
      border-radius: 20px; background: #ffffff;
      box-shadow: 0 16px 40px rgba(43, 45, 48, 0.07);
    }
    h1 { margin-top: 0; font-size: 26px; color: #6b5a57; }
    p { color: #626b7d; font-size: 14px; margin-top: 4px; line-height: 1.5; }
    label { display: block; margin: 16px 0 6px; color: #475569; font-size: 14px; font-weight: 600; }
    input {
      width: 100%; box-sizing: border-box; padding: 12px 14px;
      border: 1px solid #d8deea; border-radius: 10px; font-size: 15px;
      outline: none; transition: border-color 0.2s;
    }
    input:focus { border-color: #ffb4a2; }
    button {
      margin-top: 24px; width: 100%; padding: 13px; border: 0;
      border-radius: 10px;
      background: linear-gradient(135deg, #ffd6c2 0%, #ffb4a2 100%);
      color: #2b2f2f; font-size: 16px; font-weight: 700; cursor: pointer;
      box-shadow: 0 6px 14px rgba(255, 180, 162, 0.2);
      transition: filter 0.15s;
    }
    button:hover { filter: brightness(0.97); }
    .error {
      padding: 10px 14px; background: #fff0f0; border: 1px solid #ffcaca;
      border-radius: 8px; color: #a12626; font-size: 14px; margin-bottom: 15px;
    }
    .hint {
      margin-top: 20px; padding: 12px; background: #fdf8f5;
      border: 1px dashed #f0e9e6; border-radius: 8px; font-size: 13px; color: #78716c;
    }
    .hint strong { color: #44403c; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Вход в CRM</h1>
    <p>Система управления инфраструктурой сайтов, договоров Saby и хостинга Beget.</p>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="post" action="/login?next=${encodeURIComponent(req.query.next || '/')}">
      <label for="username">Логин</label>
      <input id="username" name="username" value="admin" autocomplete="username" required>
      <label for="password">Пароль</label>
      <input id="password" type="password" name="password" value="admin123" autocomplete="current-password" required>
      <button type="submit">Войти в систему</button>
    </form>
    <div class="hint">
      <strong>Демо-доступ:</strong> логин <code>admin</code>, пароль <code>admin123</code>
    </div>
  </main>
</body>
</html>`);
});

app.post('/login', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  if (username.toLowerCase() === db.adminUser.username.toLowerCase() && db.verifyPassword(password)) {
    req.session.crm_admin_user = db.adminUser.username;
    const nextUrl = req.query.next || '/';
    return res.redirect(nextUrl.startsWith('/') ? nextUrl : '/');
  }

  res.redirect('/login?error=' + encodeURIComponent('Неверный логин или пароль.'));
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
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
    .actions-bar { margin-bottom: 20px; display: flex; gap: 12px; align-items: center; }
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <h2>CRM-система управления инфраструктурой сайтов и договоров</h2>
      <div class="user-info">
        Администратор: <strong>${req.session.crm_admin_user || 'admin'}</strong>
        <a href="/change-password">Сменить пароль</a>
        <a href="/logout">Выйти</a>
      </div>
    </div>

    <div class="actions-bar">
      <a href="/add_page" class="btn">+ Добавить контрагента из Saby</a>
      <span style="font-size:13px; color:#94a3b8;">Всего контрагентов: ${clients.length}</span>
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
              <a href="/client/${c.id}" class="card-link">Открыть карточку / Отчеты &rarr;</a>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`);
});

// Add client page
app.get('/add_page', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Добавление контрагента из Saby</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg,#fffaf0 0%, #ffffff 100%);
      min-height: 100vh; color: #2b2f2f; padding: 25px; margin: 0;
    }
    .container {
      max-width: 720px; margin: auto; background: #ffffff; padding: 28px;
      border-radius: 12px; box-shadow: 0 8px 24px rgba(43,45,48,0.05);
      border: 1px solid #f0e9e6;
    }
    h2 { color: #6b5a57; margin-top: 0; border-bottom: 1px solid #f0e9e6; padding-bottom: 10px; }
    .form-group { margin-bottom: 18px; position: relative; }
    label { display: block; margin-bottom: 6px; font-weight: 600; font-size: 14px; color: #475569; }
    input, select {
      width: 100%; padding: 11px; box-sizing: border-box; background: #ffffff;
      border: 1px solid #d8deea; color: #2b2f2f; border-radius: 8px; font-size: 15px;
    }
    input:focus, select:focus { border-color: #ffb4a2; outline: none; }
    button {
      background: linear-gradient(135deg,#ffd6c2 0%, #ffb4a2 100%);
      color: #2b2f2f; padding: 12px 20px; border: none; border-radius: 8px;
      cursor: pointer; font-weight: 700; box-shadow: 0 6px 12px rgba(255,180,162,0.12);
      font-size: 15px;
    }
    button:hover { filter: brightness(0.97); }
    a { color: #6b5a57; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .suggest-box {
      position: absolute; left: 0; right: 0; top: 100%; max-height: 220px;
      overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 8px;
      background: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      display: none; z-index: 50;
    }
    .suggest-item {
      padding: 11px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
    }
    .suggest-item:hover { background: #fff7ed; }
    .helper-text { font-size: 12px; color: #94a3b8; margin-top: 4px; }
  </style>
  <script>
    let searchTimer = null;
    function searchCompany() {
      clearTimeout(searchTimer);
      const q = document.getElementById('search_input').value.trim();
      const box = document.getElementById('suggest-box');
      if (q.length < 2) { box.style.display = 'none'; return; }
      searchTimer = setTimeout(() => {
        fetch('/suggest_company?q=' + encodeURIComponent(q))
          .then(r => r.json())
          .then(items => {
            box.innerHTML = '';
            if (items && items.length > 0) {
              box.style.display = 'block';
              items.forEach(i => {
                const div = document.createElement('div');
                div.className = 'suggest-item';
                div.innerHTML = '<strong>' + i.name + '</strong> (ИНН: ' + i.inn + ')' + (i.address ? '<br><small style="color:#64748b;">' + i.address + '</small>' : '');
                div.onclick = () => {
                  document.getElementById('search_input').value = i.name;
                  document.getElementById('inn').value = i.inn;
                  document.getElementById('company_name').value = i.name;
                  box.style.display = 'none';
                  loadContracts(i.inn);
                };
                box.appendChild(div);
              });
            } else { box.style.display = 'none'; }
          });
      }, 300);
    }

    function loadContracts(inn) {
      fetch('/get_contracts?inn=' + encodeURIComponent(inn))
        .then(r => r.json())
        .then(data => {
          const sel = document.getElementById('contract_select');
          sel.innerHTML = '<option value="">-- Выберите договор из Saby --</option>';
          if (data.contracts && data.contracts.length > 0) {
            data.contracts.forEach(c => {
              const opt = document.createElement('option');
              opt.value = c.id + '|||' + c.number + '|||' + c.title;
              opt.textContent = c.number + ' — ' + c.title;
              sel.appendChild(opt);
            });
            // auto select first
            sel.selectedIndex = 1;
            onContractChange();
          } else {
            sel.innerHTML = '<option value="cnt-new|||б/н|||Новый договор">№ б/н — Новый договор аутсорсинга</option>';
            onContractChange();
          }
        });
    }

    function onContractChange() {
      const val = document.getElementById('contract_select').value;
      const parts = val.split('|||');
      document.getElementById('contract_id').value = parts[0] || '';
      document.getElementById('contract_number').value = parts[1] || '';
    }
  </script>
</head>
<body>
  <div class="container">
    <h2>Добавление контрагента из Saby</h2>
    <form action="/add_client" method="POST">
      <input type="hidden" id="inn" name="inn">
      <input type="hidden" id="company_name" name="company_name">
      <input type="hidden" id="contract_id" name="contract_id">
      <input type="hidden" id="contract_number" name="contract_number">

      <div class="form-group">
        <label>Поиск компании (ИНН или Название):</label>
        <input type="text" id="search_input" placeholder="Введите ИНН (например 7707083893) или наименование..." oninput="searchCompany()" autocomplete="off" required>
        <div id="suggest-box" class="suggest-box"></div>
        <div class="helper-text">Подсказка: введите 10 или 12 цифр ИНН либо часть названия компании.</div>
      </div>

      <div class="form-group">
        <label>Договор из Saby:</label>
        <select id="contract_select" onchange="onContractChange()">
          <option value="">Сначала выберите организацию выше</option>
        </select>
      </div>

      <div class="form-group">
        <label>Сайты (через запятую):</label>
        <input type="text" name="sites" placeholder="client-site.ru, shop.client-site.ru">
      </div>

      <div class="form-group">
        <label>Email для отчетов:</label>
        <input type="email" name="emails" placeholder="client@company.ru">
      </div>

      <div style="display:flex; gap:16px; align-items:center; margin-top:24px;">
        <button type="submit">Сохранить контрагента</button>
        <a href="/">&larr; Вернуться к списку</a>
      </div>
    </form>
  </div>
</body>
</html>`);
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
  res.redirect(`/client/${newClient.id}`);
});

// Client card
app.get('/client/:id', (req, res) => {
  const client = db.getClientById(req.params.id);
  if (!client) {
    return res.status(404).send('Клиент не найден. <a href="/">Вернуться</a>');
  }

  const logs = db.getWorkLogs(client.id);
  const now = new Date();
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthEnd = new Date(firstThisMonth.getTime() - 1);
  const defaultDateFrom = formatDateShort(new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1));
  const defaultDateTo = formatDateShort(lastMonthEnd);

  // Build timeline
  const timeline = [];
  const backups = db.getBackups(client.id);
  const hostEvents = db.getHostEvents(client.id);

  logs.forEach(w => {
    timeline.push({
      type: 'work_log',
      ts: new Date(w.work_date).getTime(),
      human: formatDateRus(w.work_date),
      description: w.description,
      hours: w.hours
    });
  });

  backups.forEach(b => {
    timeline.push({
      type: 'backup',
      ts: new Date(b.backup_date).getTime(),
      human: formatDateRus(b.backup_date),
      site_name: b.site_name,
      size_mb: b.size_mb,
      status: b.status,
      source: b.source
    });
  });

  hostEvents.forEach(e => {
    timeline.push({
      type: 'host_event',
      ts: e.event_time * 1000,
      human: formatDateRus(new Date(e.event_time * 1000).toISOString()),
      event_type: e.event_type,
      source: e.source,
      details: e.details
    });
  });

  timeline.sort((a, b) => b.ts - a.ts);

  const flashMessage = res.locals.flash;

  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Карточка: ${client.company_name}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg,#fffaf0 0%, #ffffff 100%);
      min-height: 100vh; color: #2b2f2f; padding: 25px; margin: 0; box-sizing: border-box;
    }
    .container {
      max-width: 1050px; margin: auto; background: #ffffff; padding: 28px;
      border-radius: 12px; box-shadow: 0 8px 24px rgba(43,45,48,0.05);
      border: 1px solid #f0e9e6;
    }
    h2, h3, h4 { color: #6b5a57; margin-top: 0; }
    .back-link { display: inline-block; margin-bottom: 16px; color: #6b5a57; text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
    .box {
      background: #fff; padding: 20px; border-radius: 10px;
      border: 1px solid #f0e9e6; box-shadow: 0 4px 12px rgba(0,0,0,0.02);
    }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 10px; border: 1px solid #f0e9e6; text-align: left; font-size: 13px; }
    th { background: #f8f4f3; color: #6b5a57; }
    label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-top: 10px; margin-bottom: 4px; }
    input, textarea, select {
      width: 100%; padding: 9px; box-sizing: border-box; background: #fff;
      border: 1px solid #d8deea; color: #2b2f2f; border-radius: 6px; font-size: 14px;
    }
    input:focus, textarea:focus, select:focus { border-color: #ffb4a2; outline: none; }
    button, .btn-link {
      background: linear-gradient(135deg,#ffd6c2 0%, #ffb4a2 100%);
      color: #2b2f2f; padding: 9px 16px; border: none; border-radius: 8px;
      cursor: pointer; font-weight: 700; margin-top: 10px; text-decoration: none;
      display: inline-block; box-shadow: 0 6px 12px rgba(255,180,162,0.1);
    }
    button:hover, .btn-link:hover { filter: brightness(0.98); }
    .flash-success {
      background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46;
      padding: 12px; border-radius: 8px; margin-bottom: 18px; font-size: 14px;
    }
    .badge { padding: 3px 8px; border-radius: 4px; font-size: 12px; background: #f1f5f9; }
    .badge-ok { background: #dcfce7; color: #166534; font-weight: 600; }
  </style>
  <script>
    function fmtY(d){ return d.toISOString().slice(0,10); }
    function setPrevMonth(){
      const now = new Date();
      const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthEnd = new Date(firstThisMonth.getTime() - 1);
      const from = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
      document.querySelector('input[name="date_from"]').value = fmtY(from);
      document.querySelector('input[name="date_to"]').value = fmtY(lastMonthEnd);
    }
    function setThisMonth(){
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      document.querySelector('input[name="date_from"]').value = fmtY(from);
      document.querySelector('input[name="date_to"]').value = fmtY(new Date());
    }
    function setLast7Days(){
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      document.querySelector('input[name="date_from"]').value = fmtY(from);
      document.querySelector('input[name="date_to"]').value = fmtY(new Date());
    }
  </script>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">&larr; Вернуться к списку контрагентов</a>
    <h2>${client.company_name}</h2>

    ${flashMessage ? `<div class="flash-success">${flashMessage}</div>` : ''}

    <div class="grid">
      <!-- Saby Data Box -->
      <div class="box">
        <h3>Реквизиты и договор Saby</h3>
        <p><strong>ИНН:</strong> ${client.inn}</p>
        <p><strong>Договор Saby:</strong> ${client.saby_contract_number || 'Не указан'}</p>
        <p><strong>Сайты:</strong> ${client.sites || 'Не указаны'}</p>
        <p><strong>Email для отчетов:</strong> ${client.email_reports || client.emails || 'Не указан'}</p>
      </div>

      <!-- Beget Hosting Access Box -->
      <div class="box">
        <h3>Доступы Beget (Хостинг / Почта / Домены)</h3>
        <form action="/client/${client.id}/update_beget" method="POST">
          <label>Логин Beget:</label>
          <input type="text" name="beget_login" value="${client.beget_login || ''}">
          <label>Пароль Beget:</label>
          <input type="password" name="beget_pass" value="${client.beget_password || ''}">
          <label>API-ключ Beget:</label>
          <input type="text" name="beget_api_key" value="${client.beget_api_key || ''}">
          <label>Сайты:</label>
          <input type="text" name="sites" value="${client.sites || ''}">
          <label>Email (через запятую):</label>
          <input type="text" name="emails" value="${client.email_reports || client.emails || ''}">
          <label>Периодичность рассылки отчёта:</label>
          <select name="report_schedule">
            <option value="none" ${client.report_schedule === 'none' ? 'selected' : ''}>Не рассылать</option>
            <option value="daily" ${client.report_schedule === 'daily' ? 'selected' : ''}>Ежедневно (за вчера)</option>
            <option value="weekly" ${client.report_schedule === 'weekly' ? 'selected' : ''}>Еженедельно (по понедельникам)</option>
            <option value="monthly" ${client.report_schedule === 'monthly' ? 'selected' : ''}>Ежемесячно (за предыдущий месяц)</option>
          </select>
          <label>День старта отчётов (1-28):</label>
          <input type="number" min="1" max="28" name="report_start_day" value="${client.report_start_day || 1}">
          <div style="margin-top:12px;">
            <strong style="display:block; font-size:13px; margin-bottom:6px;">Секции отчета:</strong>
            <label style="font-weight:normal;"><input type="checkbox" name="report_sections" value="backups" checked> Резервные копии (включая 1С-Битрикс)</label>
            <label style="font-weight:normal;"><input type="checkbox" name="report_sections" value="host_events" checked> События хостинга (домены, сайты, БД)</label>
            <label style="font-weight:normal;"><input type="checkbox" name="report_sections" value="mailboxes" checked> Почтовые ящики</label>
            <label style="font-weight:normal;"><input type="checkbox" name="report_sections" value="account" checked> Баланс и аккаунт</label>
            <label style="font-weight:normal;"><input type="checkbox" name="report_sections" value="certs" checked> SSL-сертификаты и сроки</label>
          </div>
          <button type="submit" style="margin-top:14px;">Сохранить настройки Beget</button>
        </form>
      </div>
    </div>

    <!-- Client Portal Access Box -->
    <div style="margin-top: 20px;" class="box">
      <h3>Клиентский кабинет</h3>
      <p style="font-size:14px; color:#64748b;">
        Создайте защищенную отзывную ссылку, по которой клиент сможет самостоятельно выбрать период и скачать официальный отчет о сопровождении.
      </p>
      <form action="/client/${client.id}/create-access-link" method="POST">
        <button type="submit">Создать новую ссылку кабинета</button>
      </form>
    </div>

    <!-- Report Generation Box -->
    <div style="margin-top: 20px;" class="box">
      <h3>Генерация отчета и мониторинг</h3>
      <p style="font-size:14px; color:#64748b;">
        Выберите период для формирования отчета с перечнем выполненных работ, резервных копий 1С-Битрикс, состоянием SSL и балансом.
      </p>
      <form action="/client/${client.id}/report" method="GET" target="_blank" style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; margin-top:12px;">
        <div style="flex:1; min-width:140px;">
          <label>Дата с:</label>
          <input type="date" name="date_from" value="${defaultDateFrom}" required>
        </div>
        <div style="flex:1; min-width:140px;">
          <label>Дата по:</label>
          <input type="date" name="date_to" value="${defaultDateTo}" required>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button type="submit" style="margin-top:0;">Сформировать отчет</button>
          <button type="button" onclick="setPrevMonth()" style="margin-top:0; background:#f1f5f9; color:#334155;">Прошлый месяц</button>
          <button type="button" onclick="setThisMonth()" style="margin-top:0; background:#f1f5f9; color:#334155;">Текущий месяц</button>
          <button type="button" onclick="setLast7Days()" style="margin-top:0; background:#f1f5f9; color:#334155;">7 дней</button>
        </div>
      </form>
    </div>

    <!-- Work Logs Table & Add Form -->
    <div style="margin-top: 25px;" class="box">
      <h3>Учет выполненных работ и обращений</h3>
      <table>
        <thead>
          <tr>
            <th>Дата / время</th>
            <th>Описание работ / инцидентов</th>
            <th>Часы</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          ${logs.length > 0 ? logs.map(l => `
            <tr>
              <td style="white-space:nowrap;">${formatDateRus(l.work_date)}</td>
              <td>${l.description}</td>
              <td style="font-weight:600; white-space:nowrap;">${l.hours} ч.</td>
              <td style="white-space:nowrap;">
                <a href="/client/${client.id}/edit_log/${l.id}" style="color:#0284c7; margin-right:8px;">Редактировать</a>
                <a href="/client/${client.id}/delete_log/${l.id}" style="color:#ea580c;" onclick="return confirm('Удалить эту запись?');">Удалить</a>
              </td>
            </tr>
          `).join('') : `
            <tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:16px;">Нет записей о работах</td></tr>
          `}
        </tbody>
      </table>

      <form action="/client/${client.id}/add_log" method="POST" style="margin-top:20px; padding-top:16px; border-top:1px solid #f0e9e6;">
        <h4>Добавить запись о работах</h4>
        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:12px;">
          <div>
            <label>Описание работ:</label>
            <textarea name="description" rows="2" placeholder="Например: Плановое резервное копирование, обновление плагинов..." required></textarea>
          </div>
          <div>
            <label>Дата и время (пусто — сейчас):</label>
            <input type="datetime-local" name="work_date_local">
            <label>Часы:</label>
            <input type="number" step="0.5" min="0.1" name="hours" value="1.0" required>
          </div>
        </div>
        <button type="submit">Добавить запись в журнал</button>
      </form>
    </div>

    <!-- Continuous Timeline -->
    <div style="margin-top: 25px;" class="box">
      <h3>Непрерывная лента (работы / бэкапы / события хостинга)</h3>
      ${timeline.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Время</th>
              <th>Тип</th>
              <th>Описание события</th>
            </tr>
          </thead>
          <tbody>
            ${timeline.map(e => `
              <tr>
                <td style="white-space:nowrap;">${e.human || ''}</td>
                <td>
                  <span class="badge ${e.type === 'backup' ? 'badge-ok' : ''}">
                    ${e.type === 'work_log' ? 'Работа' : e.type === 'backup' ? 'Бэкап' : 'Хостинг'}
                  </span>
                </td>
                <td>
                  ${e.type === 'work_log' ? `${e.description} (${e.hours} ч.)` : ''}
                  ${e.type === 'backup' ? `Резервная копия: <strong>${e.site_name}</strong> — ${e.status} — ${e.size_mb} МБ (${e.source})` : ''}
                  ${e.type === 'host_event' ? `Снимок хостинга: баланс ${e.details?.account?.user_balance || '—'} руб., доменов: ${(e.details?.snapshot?.domains || []).length}` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `
        <p style="color:#94a3b8;">Лента пуста.</p>
      `}
    </div>
  </div>
</body>
</html>`);
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
    <p><a href="/client/${client.id}">&larr; Вернуться в карточку клиента</a></p>
  </main>
</body>
</html>`);
});

// Public client portal
app.get('/public/client/:token', (req, res) => {
  const token = req.params.token;
  const client = db.getClientByToken(token);
  if (!client) {
    return res.status(404).send('Ссылка недействительна или отозвана');
  }

  const now = new Date();
  const first = formatDateShort(new Date(now.getFullYear(), now.getMonth(), 1));
  const today = formatDateShort(now);

  res.send(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Кабинет ${client.company_name}</title>
  <style>
    body {
      margin: 0; min-height: 100vh; background: linear-gradient(135deg,#f5f7fb,#eef1f7);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #20242c; padding: 24px; display: grid; place-items: center;
    }
    .card {
      max-width: 600px; width: 100%; padding: 36px; background: rgba(255,255,255,.95);
      border: 1px solid #fff; border-radius: 24px; box-shadow: 0 20px 60px rgba(37,48,77,0.1);
    }
    h1 { margin-top: 0; font-size: 24px; color: #202b45; }
    label { display: block; margin: 14px 0 6px; color: #626b7d; font-size: 14px; font-weight: 600; }
    input {
      width: 100%; box-sizing: border-box; padding: 12px;
      border: 1px solid #d8deea; border-radius: 10px; font-size: 15px;
    }
    button {
      margin-top: 22px; width: 100%; padding: 13px; border: 0;
      border-radius: 10px; background: #202b45; color: #fff; font-size: 16px;
      font-weight: 700; cursor: pointer;
    }
    button:hover { background: #151d30; }
    .muted { color: #687286; font-size: 14px; }
  </style>
</head>
<body>
  <main class="card">
    <p class="muted">Клиентский кабинет технического сопровождения</p>
    <h1>${client.company_name}</h1>
    <p class="muted">Выберите период, чтобы сформировать подробный отчет о выполненных работах, резервных копиях и статусе серверов.</p>
    <form method="get" action="/client/${client.id}/report">
      <input type="hidden" name="access_token" value="${token}">
      <label>Дата начала:</label>
      <input type="date" name="date_from" value="${first}" required>
      <label>Дата окончания:</label>
      <input type="date" name="date_to" value="${today}" required>
      <button type="submit">Сформировать отчёт</button>
    </form>
  </main>
</body>
</html>`);
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
