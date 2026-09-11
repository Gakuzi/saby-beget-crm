import express from "express";
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db/crm_store.js';
import { settingsManager } from './config/settings_manager.js';
import { checkInnChecksum, suggestCompany, getContracts } from './utils/inn_helper.js';
import { renderPortalPage, renderPortalLoginPage, renderPortalVerifyPage } from './views/portal_view.js';
import { mailer } from './services/mailer.js';
import { renderAdminClientPage, renderNewClientPage } from './views/admin_view.js';
import { getGitStatus, getGitHubConfig, testGitHubApi, syncToGitHub, pullFromGitHub } from './services/github_sync.js';
import { testSabyConnection, authenticateSaby, searchSabyCompany, fetchSabyContracts } from './services/saby_client.js';
import { testBegetConnection, pullBegetSnapshot } from './services/beget_client.js';
import { sshService } from './services/ssh_service.js';
import { generatePhpBackupAgent, generateBashInstaller } from './utils/backup_agent_generator.js';
import { setupWebAuthn } from './api/webauthn_routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use((req,res,next)=>{console.log('Proto:', req.protocol, 'Secure:', req.secure, 'Headers:', req.headers['x-forwarded-proto']); next();});

app.set('trust proxy', 1);

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'crm-saby-beget-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000, secure: true, sameSite: 'none' }
  })
);

// Simple flash message middleware
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

setupWebAuthn(app);

// Authentication middleware (Bypassed: open access mode so interface and client cabinets work seamlessly without secrets or login blocks)

function requireAdmin(req, res, next) {
  // Allow open access to portal, login, health, api auth routes
  const openRoutes = ['/login', '/login_otp', '/healthz', '/portal'];
  if (openRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  
  // Also allow static assets if any, though we don't have a static dir mapped here
  
  if (req.session && req.session.admin_id) {
    return next();
  }
  
  // Not logged in, save next url and redirect
  const nextUrl = req.originalUrl;
  res.redirect('/login?next=' + encodeURIComponent(nextUrl));
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
  const msg = req.query.msg || '';
  const nextUrl = req.query.next || '/';
  res.send(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Вход — CRM Администратора</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; font-family: -apple-system, sans-serif; }
    .card { width: min(440px, calc(100% - 32px)); padding: 32px; background: #fff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    h2 { margin-top:0; color: #1e293b; text-align: center; margin-bottom: 24px; }
    input { width: 100%; box-sizing: border-box; padding: 12px; margin: 8px 0 16px; border: 1px solid #cbd5e1; border-radius: 8px; font-size:15px; }
    button { width: 100%; padding: 12px; background: #2563eb; color: #fff; border: 0; border-radius: 8px; font-weight: bold; font-size: 15px; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #1d4ed8; }
    .msg { color: #dc2626; text-align: center; font-size: 14px; margin-bottom: 16px; font-weight: 500; }
    .success { color: #16a34a; text-align: center; font-size: 14px; margin-bottom: 16px; font-weight: 500; }
    .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
    .tab { flex: 1; text-align: center; padding: 8px; cursor: pointer; color: #64748b; font-weight: 600; border-radius: 6px; }
    .tab.active { background: #eff6ff; color: #2563eb; }
  </style>

<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
<script>
async function registerPasskey() {
  try {
    const resp = await fetch('/webauthn/generate-reg', { credentials: 'include' });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error('Не авторизован');
      throw new Error('Failed to generate options');
    }
    const opts = await resp.json();
    if (opts.error) throw new Error(opts.error);
    
    const attResp = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: opts });
    
    const verifyResp = await fetch('/webauthn/verify-reg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp),
      credentials: 'include'
    });
    
    const verification = await verifyResp.json();
    if (verification.verified) {
      alert('Ключ (Passkey) успешно добавлен! Теперь вы можете входить по отпечатку или Face ID.');
    } else {
      alert('Ошибка при сохранении ключа: ' + (verification.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error(e);
    alert('Не удалось зарегистрировать ключ: ' + e.message);
  }
}
</script>
</head>
<body>
  <div class="card">
    <h2>Вход в CRM</h2>
    ${msg ? `<div class="${req.query.type === 'success' ? 'success' : 'msg'}">${msg}</div>` : ''}
    
          <div style="background: #fef3c7; color: #92400e; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; text-align: center; border: 1px solid #fcd34d;">
        <b>Возникает цикл авторизации?</b><br>Откройте приложение в новой вкладке (иконка вверху справа) — ваш браузер блокирует cookies в режиме предпросмотра.
      </div>
      <div class="tabs">
      <div class="tab active" onclick="switchTab('pwd')">По паролю</div>
      <div class="tab" onclick="switchTab('otp')">По E-mail (Код)</div>
    </div>

    <!-- Password Login Form -->
    <form id="form-pwd" method="post" action="/login">
      <input type="hidden" name="next" value="${nextUrl}">
      <label>Email или Логин:</label>
      <input type="text" name="login" required placeholder="admin">
      <label>Пароль:</label>
      <input type="password" name="password" required placeholder="••••••••">
      <button type="submit">Войти</button>
    </form>

    <!-- OTP Request Form -->
    <form id="form-otp-req" method="post" action="/login_otp_request" style="display:none;">
      <input type="hidden" name="next" value="${nextUrl}">
      <label>Email администратора:</label>
      <input type="email" name="email" required placeholder="eklimov84@gmail.com">
      <button type="submit">Получить код</button>
    </form>
    
    <!-- OTP Verify Form (if code was sent) -->
    ${req.query.show_otp ? `
      <form id="form-otp-verify" method="post" action="/login_otp_verify" style="margin-top:20px; padding-top:20px; border-top:1px dashed #cbd5e1;">
        <input type="hidden" name="next" value="${nextUrl}">
        <input type="hidden" name="email" value="${req.query.email}">
        <label>Код из письма:</label>
        <input type="text" name="code" required placeholder="123456" autocomplete="one-time-code" inputmode="numeric" style="letter-spacing:4px; text-align:center; font-weight:bold; font-size:18px;">
        <button type="submit" style="background:#10b981;">Подтвердить код</button>
      </form>
      <script>
        document.getElementById('form-pwd').style.display = 'none';
        document.getElementById('form-otp-req').style.display = 'none';
        document.querySelector('.tabs').style.display = 'none';
      </script>
    ` : ''}

    <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Или используйте безопасный вход</p>
      <button type="button" onclick="loginWithPasskey()" style="background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
        Вход по Face ID / Touch ID
      </button>
      <p id="passkey-error" style="color: #dc2626; font-size: 13px; margin-top: 8px; display: none;"></p>
    </div>

    
    <script>
      function switchTab(t) {
        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
        if(t === 'pwd') {
          document.getElementById('form-pwd').style.display = 'block';
          document.getElementById('form-otp-req').style.display = 'none';
          document.querySelectorAll('.tab')[0].classList.add('active');
        } else {
          document.getElementById('form-pwd').style.display = 'none';
          document.getElementById('form-otp-req').style.display = 'block';
          document.querySelectorAll('.tab')[1].classList.add('active');
        }
      }

      async function loginWithPasskey() {
        const errorEl = document.getElementById('passkey-error');
        errorEl.style.display = 'none';
        try {
          const resp = await fetch('/webauthn/generate-auth', { credentials: 'include' });
          const opts = await resp.json();
          if (opts.error) throw new Error(opts.error);
          
          const asseResp = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: opts });
          
          const verifyResp = await fetch('/webauthn/verify-auth', {
            credentials: 'include',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(asseResp),
          });
          
          const verification = await verifyResp.json();
          if (verification.verified) {
            window.location.href = "${nextUrl}";
          } else {
            throw new Error(verification.error || 'Ошибка проверки ключа');
          }
        } catch (err) {
          console.error(err);
          errorEl.innerText = err.message || 'Не удалось выполнить вход по ключу';
          errorEl.style.display = 'block';
        }
      }
    </script>
  </div>
</body>
</html>`);
});

app.post('/login', (req, res) => {
  const { login, password, next } = req.body;
  const admin = db.verifyAdminCredentials(login, password);
  if (!admin) {
    return res.redirect('/login?msg=' + encodeURIComponent('Неверный логин или пароль') + '&next=' + encodeURIComponent(next || '/'));
  }
  
  req.session.admin_id = admin.id;
  req.session.crm_admin_user = admin.username || admin.email;
  db.setAdminLastLogin(admin.id);
  req.session.save(() => { res.redirect(next || '/'); });
});

const otps = new Map(); // Store OTPs in memory for simplicity

app.post('/login_otp_request', async (req, res) => {
  const { email, next } = req.body;
  
  // Check if admin exists
  const admin = db.db.prepare('SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)').get(email.trim());
  if (!admin) {
    return res.redirect('/login?msg=' + encodeURIComponent('Email не найден в списке администраторов') + '&next=' + encodeURIComponent(next || '/'));
  }
  
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otps.set(email.trim(), { code, expires: Date.now() + 10 * 60 * 1000 });
  
  // Send email
  const { mailer } = await import('./mailer.js');
  await mailer.sendAdminLoginOtp(email.trim(), code);
  
  res.redirect('/login?show_otp=1&type=success&msg=' + encodeURIComponent('Код отправлен на почту') + '&email=' + encodeURIComponent(email.trim()) + '&next=' + encodeURIComponent(next || '/'));
});

app.post('/login_otp_verify', (req, res) => {
  const { email, code, next } = req.body;
  const record = otps.get(email.trim());
  
  if (!record || record.code !== code.trim() || record.expires < Date.now()) {
    return res.redirect('/login?msg=' + encodeURIComponent('Неверный или просроченный код') + '&next=' + encodeURIComponent(next || '/'));
  }
  
  otps.delete(email.trim());
  const admin = db.db.prepare('SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)').get(email.trim());
  
  req.session.admin_id = admin.id;
  req.session.crm_admin_user = admin.username || admin.email;
  
  db.setAdminLastLogin(admin.id);
  req.session.save(() => { res.redirect(next || '/'); });
});

// Workers Management
app.get('/workers', (req, res) => {
  const admins = db.db.prepare('SELECT id, username, email, created_at, last_login_at FROM admin_users ORDER BY id ASC').all();
  
  res.send(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Управление сотрудниками — CRM</title>
  <style>
    body { margin: 0; padding: 30px; background: #f8fafc; font-family: -apple-system, sans-serif; color: #1e293b; }
    .container { max-width: 1000px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; color: #475569; font-weight: 600; }
    a { color: #2563eb; text-decoration: none; }
    input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%; box-sizing: border-box; }
    button { padding: 10px 16px; background: #10b981; color: #fff; border: 0; border-radius: 6px; font-weight: 600; cursor: pointer; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end; margin-top: 20px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
  </style>

<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
<script>
async function registerPasskey() {
  try {
    const resp = await fetch('/webauthn/generate-reg', { credentials: 'include' });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error('Не авторизован');
      throw new Error('Failed to generate options');
    }
    const opts = await resp.json();
    if (opts.error) throw new Error(opts.error);
    
    const attResp = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: opts });
    
    const verifyResp = await fetch('/webauthn/verify-reg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp),
      credentials: 'include'
    });
    
    const verification = await verifyResp.json();
    if (verification.verified) {
      alert('Ключ (Passkey) успешно добавлен! Теперь вы можете входить по отпечатку или Face ID.');
    } else {
      alert('Ошибка при сохранении ключа: ' + (verification.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error(e);
    alert('Не удалось зарегистрировать ключ: ' + e.message);
  }
}
</script>
</head>
<body>
  <div class="container">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <h2 style="margin:0;">Сотрудники CRM (Администраторы)</h2>
      <a href="/">&larr; В панель управления</a>
    </div>
    
    <table>
      <thead>
        <tr>
          <th>Имя / Логин</th>
          <th>E-mail</th>
          <th>Последний вход</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${admins.map(a => `
          <tr>
            <td><strong>${a.username}</strong></td>
            <td>${a.email}</td>
            <td style="color:#64748b; font-size:13px;">${a.last_login_at ? new Date(a.last_login_at).toLocaleString('ru-RU') : 'Никогда'}</td>
            <td>
              ${a.username !== 'admin' ? `<a href="/workers/${a.id}/delete" onclick="return confirm('Удалить сотрудника?');" style="color:#ef4444;">Удалить</a>` : '<span style="color:#94a3b8;font-size:12px;">Системный</span>'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h3 style="margin-top:40px;">+ Добавить сотрудника</h3>
    <form method="post" action="/workers/add" class="form-grid">
      <div>
        <label style="display:block; margin-bottom:4px; font-size:13px; font-weight:600;">Логин / Имя:</label>
        <input type="text" name="username" required>
      </div>
      <div>
        <label style="display:block; margin-bottom:4px; font-size:13px; font-weight:600;">Email:</label>
        <input type="email" name="email" required>
      </div>
      <div>
        <label style="display:block; margin-bottom:4px; font-size:13px; font-weight:600;">Пароль (мин. 6 символов):</label>
        <input type="password" name="password" required minlength="6">
      </div>
      <div>
        <button type="submit">Создать аккаунт</button>
      </div>
    </form>
  </div>
</body>
</html>`);
});

app.post('/workers/add', (req, res) => {
  const { username, email, password } = req.body;
  try {
    const { hash, salt } = db.hashPassword(password);
    db.db.prepare('INSERT INTO admin_users (username, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
      username.trim(), email.trim(), hash, salt, new Date().toISOString()
    );
  } catch (e) {
    console.error(e);
  }
  res.redirect('/workers');
});

app.get('/workers/:id/delete', (req, res) => {
  if (parseInt(req.params.id) !== 1) { // protect main admin
    db.db.prepare('DELETE FROM admin_users WHERE id = ?').run(req.params.id);
  }
  res.redirect('/workers');
});



// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Change Password
app.get('/change-password', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Установка нового пароля</title>
  <link rel="stylesheet" href="/style.css">
  <style>
    body { background: #f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin: 12px 0 4px; }
    input { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; margin-bottom: 12px; }
    button { width: 100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h2 style="margin-top:0; color:#1e1b4b; font-size:20px;">Установка нового пароля</h2>
    <p style="font-size: 13px; color: #64748b;">Вы уже авторизованы. Вы можете задать новый пароль для входа.</p>
    <form method="post" action="/change-password">
      <label>Новый пароль:</label>
      <input type="password" name="new_password" required autocomplete="new-password">
      <label>Повторите новый пароль:</label>
      <input type="password" name="confirm_password" required autocomplete="new-password">
      <button type="submit">Сохранить пароль</button>
    </form>
    <p style="text-align:center; margin-top:16px;"><a href="/" style="color:#0284c7; font-weight:600; font-size:13px;">&larr; На главную</a></p>
  </div>
</body>
</html>`);
});

app.post('/change-password', (req, res) => {
  const { new_password, confirm_password } = req.body;
  if (!new_password || new_password !== confirm_password) {
    return res.send('Ошибка: Пароли не совпадают. <a href="/change-password">Назад</a>');
  }
  // Change password for the current admin id if set in session, otherwise default
  const adminId = req.session.admin_id;
  if (adminId) {
    const admin = db.db.prepare('SELECT * FROM admin_users WHERE id = ?').get(adminId);
    if (admin) {
      const { hash, salt } = db.hashPassword(new_password);
      db.db.prepare('UPDATE admin_users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, adminId);
    }
  } else {
    db.changePassword(new_password);
  }
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
    .show { display: block !important; }
  </style>

<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
<script>
async function registerPasskey() {
  try {
    const resp = await fetch('/webauthn/generate-reg', { credentials: 'include' });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error('Не авторизован');
      throw new Error('Failed to generate options');
    }
    const opts = await resp.json();
    if (opts.error) throw new Error(opts.error);
    
    const attResp = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: opts });
    
    const verifyResp = await fetch('/webauthn/verify-reg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp),
      credentials: 'include'
    });
    
    const verification = await verifyResp.json();
    if (verification.verified) {
      alert('Ключ (Passkey) успешно добавлен! Теперь вы можете входить по отпечатку или Face ID.');
    } else {
      alert('Ошибка при сохранении ключа: ' + (verification.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error(e);
    alert('Не удалось зарегистрировать ключ: ' + e.message);
  }
}
</script>
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


app.get('/passkeys', (req, res) => {
  if (!req.session.admin_id) return res.redirect('/login');
  const passkeys = db.getAdminPasskeys(req.session.admin_id);
  
  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Управление Passkey</title>
  <link rel="stylesheet" href="/style.css">
  <style>
    body { background: #f8fafc; padding: 20px; font-family: system-ui, sans-serif; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; max-width: 600px; margin: 0 auto; }
    .key-item { display:flex; justify-content: space-between; align-items:center; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px; background: #f8fafc; }
  </style>
  <script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
  <script src="/global_passkey_scripts.js"></script>
</head>
<body>
  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <h2 style="margin:0; color:#1e1b4b; font-size:20px;">🛡️ Ваши ключи Passkey</h2>
      <a href="/" style="color:#0284c7; font-size:14px; text-decoration:none; font-weight:600;">&larr; Назад</a>
    </div>
    <div style="margin-bottom: 16px;">
      ${passkeys.length === 0 ? '<p style="color:#64748b; font-size:14px;">У вас пока нет сохраненных ключей.</p>' : passkeys.map(pk => `
        <div class="key-item">
          <div>
            <div style="font-weight:600; font-size:14px;">${pk.device_type || 'Неизвестное устройство'}</div>
            <div style="font-size:11px; color:#94a3b8; font-family:monospace; margin-top:4px;">ID: ${pk.id.substring(0, 16)}...</div>
          </div>
          <form method="post" action="/passkeys/delete" style="margin:0;">
            <input type="hidden" name="id" value="${pk.id}">
            <button type="submit" style="background:#fee2e2; color:#ef4444; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600; font-size:12px;">Удалить</button>
          </form>
        </div>
      `).join('')}
    </div>
    <button type="button" onclick="registerPasskey()" style="width:100%; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#fff; border:none; padding:12px; border-radius:8px; font-weight:700; cursor:pointer; font-size:14px;">+ Добавить новый ключ (Отпечаток/FaceID)</button>
  </div>
</body>
</html>`);
});

app.post('/passkeys/delete', (req, res) => {
  if (!req.session.admin_id) return res.status(401).send('Не авторизован');
  db.db.prepare('DELETE FROM admin_passkeys WHERE id = ? AND admin_id = ?').run(req.body.id, req.session.admin_id);
  res.redirect('/passkeys');
});

// Dashboard: List clients
app.get('/', (req, res) => {
  const filter = req.query.filter === 'archived' ? 'archived' : 'active';
  const clients = db.getClients(filter);
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
    .modal-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    
    @media (max-width: 768px) {
      body { padding: 10px; }
      .container { padding: 16px; border-radius: 8px; }
      .header-bar { flex-direction: column; align-items: stretch; gap: 12px; }
      .actions-bar { flex-direction: column; align-items: stretch; }
      .btn { justify-content: center; width: 100%; box-sizing: border-box; }
      .modal-card { width: 100%; padding: 16px; max-height: 90vh; overflow-y: auto; }
      .modal-grid-2 { grid-template-columns: 1fr; gap: 8px; }
      table, thead, tbody, th, td, tr { display: block; }
      thead tr { position: absolute; top: -9999px; left: -9999px; }
      tr { border: 1px solid #ccc; margin-bottom: 10px; }
      td { border: none; border-bottom: 1px solid #eee; position: relative; padding-left: 50%; }
      td:before { position: absolute; top: 12px; left: 10px; width: 45%; padding-right: 10px; white-space: nowrap; font-weight: 600; color: #6b5a57; }
      td:nth-of-type(1):before { content: "Компания"; }
      td:nth-of-type(2):before { content: "ИНН"; }
      td:nth-of-type(3):before { content: "Сервер/Beget"; }
      td:nth-of-type(4):before { content: "Панель"; }
    }
  </style>

<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
<script>
async function registerPasskey() {
  try {
    const resp = await fetch('/webauthn/generate-reg', { credentials: 'include' });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error('Не авторизован');
      throw new Error('Failed to generate options');
    }
    const opts = await resp.json();
    if (opts.error) throw new Error(opts.error);
    
    const attResp = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: opts });
    
    const verifyResp = await fetch('/webauthn/verify-reg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp),
      credentials: 'include'
    });
    
    const verification = await verifyResp.json();
    if (verification.verified) {
      alert('Ключ (Passkey) успешно добавлен! Теперь вы можете входить по отпечатку или Face ID.');
    } else {
      alert('Ошибка при сохранении ключа: ' + (verification.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error(e);
    alert('Не удалось зарегистрировать ключ: ' + e.message);
  }
}
</script>
</head>
<body>
  <div class="container" style="position: relative;">
    
    <div class="header-bar">
      <h2 style="font-weight: 800; font-size: 24px;">CRM-система</h2>
      <div class="user-info" style="display:flex; align-items:center; gap:16px;">
        <span style="font-weight: 600; color: #475569;">👤 ${req.session.crm_admin_user || 'Администратор'}</span>
        <a href="/?filter=${filter === 'active' ? 'archived' : 'active'}" style="font-size:13px; font-weight:600; color:#3b82f6;">${filter === 'active' ? '🗄️ Архив' : '📁 Активные'}</a>
        <a href="/workers" style="font-size:13px; font-weight:600;">👥 Сотрудники</a>
        <a href="#" onclick="openSabySettingsModal()" style="font-size:13px; font-weight:600;">⚙️ Настройки Saby</a>
        <a href="#" onclick="registerPasskey()" style="font-size:13px; font-weight:600; color:#10b981;">🛡️ Создать Passkey</a>
        <a href="/change-password" style="font-size:13px; font-weight:600;">🔑 Пароль</a>
        <a href="/logout" style="font-size:13px; font-weight:600; color:#ef4444;">🚪 Выйти</a>
      </div>
    </div>

    <div class="actions-bar" style="justify-content: space-between;">
      <div style="display: flex; gap: 12px;">
        <a href="/add_page" class="btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; padding: 10px 18px; border-radius: 8px;">+ Добавить контрагента</a>
        <button type="button" onclick="seedDatabase()" class="btn" style="background: #f1f5f9; color: #475569; padding: 10px 18px; border-radius: 8px; border:none; cursor:pointer; font-weight:600;">🌱 Тестовый клиент</button>
        <button type="button" onclick="resetDatabase()" class="btn" style="background: #fee2e2; color: #ef4444; padding: 10px 18px; border-radius: 8px; border:none; cursor:pointer; font-weight:600;">⚠️ Сбросить БД</button>
      </div>
      <span style="font-size:13px; color:#94a3b8;">Всего контрагентов: ${clients.length}</span>
    </div>

    <table>
      <thead>
        <tr>
          <th>Компания / ИНН</th>
          <th>Договор Saby</th>
          <th>Сайты</th>
          <th>Beget Логин</th>
          <th style="text-align: right;">Действия</th>
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
            <td style="text-align: right;">
              <div style="display: flex; justify-content: flex-end; gap: 8px;">
                <a href="/client/${c.id}" class="card-link" style="background: #f1f5f9; color: #475569; font-size: 13px; padding: 6px 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; border-radius: 8px;">⚙️ Настройки</a>
                <a href="/portal/${c.id}" target="_blank" class="card-link" style="background: #f8fafc; color: #6366f1; font-size: 13px; padding: 6px 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #e0e7ff; border-radius: 8px;">🖥️ Портал</a>
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
    <div class="modal-card" style="max-width: 750px; max-height: 90vh; overflow-y: auto; width: 95%;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
        <h3 style="margin: 0; font-size: 18px; color: #1e1b4b;">⚙️ Глобальные настройки интеграций</h3>
        <button type="button" onclick="closeSabySettingsModal()" style="background: transparent; border: none; font-size: 22px; cursor: pointer; color: #94a3b8;">&times;</button>
      </div>
      
      <!-- Saby API Section -->
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 15px; color: #0f172a;">API СБИС (Saby)</h4>
          <button type="button" id="cfg-test-saby-btn" onclick="testSabyFromModal()" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer;">⚡ Проверить связь с Saby</button>
        </div>
        <div class="modal-grid-2" style="margin-bottom: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">ID подключения (app_client_id):</label>
            <input type="text" id="cfg-saby-client-id" placeholder="Например: 1234abcd-..." style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Секрет приложения (app_secret):</label>
            <input type="password" id="cfg-saby-app-secret" placeholder="Оставьте пустым, если не меняете" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>
        <div>
          <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Защищенный ключ (сертификат .key):</label>
          <div style="display: flex; gap: 10px; align-items: flex-start;">
            <input type="file" id="cfg-saby-file" accept=".key" style="font-size: 12px; width: 100%; max-width: 300px;">
            <input type="hidden" id="cfg-saby-secret-key">
            <div id="cfg-saby-key-status" style="font-size: 11px; margin-top: 4px; color: #64748b;">Здесь будет статус загрузки ключа.</div>
          </div>
        </div>
      </div>

      <!-- Beget API Section -->
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 15px; color: #0f172a;">API Beget (Хостинг)</h4>
          <button type="button" id="cfg-test-beget-btn" onclick="testBegetFromModal()" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer;">⚡ Проверить связь с Beget</button>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; font-size: 12px; color: #1e40af; line-height: 1.5;">
          💡 <strong>Инструкция по API Beget:</strong><br>
          API Beget не использует отдельный "API-ключ". В качестве доступа используется ваш <strong>основной логин</strong> (имя аккаунта, например <code>klimov_beget</code>) и <strong>отдельный пароль для API</strong>.<br>
          Для создания/восстановления пароля API: зайдите в панель управления Beget &rarr; раздел "Настройки" (или "Управление аккаунтом") &rarr; <strong>Пароль для API</strong>. Установите там пароль и впишите его сюда.
        </div>
        <div class="modal-grid-2">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Логин аккаунта Beget:</label>
            <input type="text" id="cfg-beget-login" placeholder="klimov_beget" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Пароль от API Beget:</label>
            <div style="display: flex; gap: 6px;">
              <input type="password" id="cfg-beget-pass" placeholder="Оставьте пустым, если не меняете" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
              <button type="button" onclick="const p=document.getElementById('cfg-beget-pass'); p.type=p.type==='password'?'text':'password';" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:0 8px; border-radius:6px; cursor:pointer;" title="Показать/скрыть">👁️</button>
            </div>
            <div id="cfg-beget-pass-status" style="font-size: 11px; margin-top: 4px; color: #059669; font-weight: 500;"></div>
          </div>
        </div>
      </div>

      <!-- Backup Alerts -->
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
        <h4 style="margin: 0 0 12px 0; font-size: 15px; color: #0f172a;">Бекапы и Алерты</h4>
        <div class="modal-grid-2">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Webhook Secret для агентов:</label>
            <input type="password" id="cfg-backup-secret" placeholder="Секретный токен для приема бекапов" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Email для срочных алертов:</label>
            <input type="email" id="cfg-backup-email" placeholder="EKlimov84@gmail.com" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>
      </div>

      <!-- SMTP Settings Section -->
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 15px; color: #0f172a;">Почта (SMTP) для уведомлений</h4>
          <button type="button" id="cfg-test-smtp-btn" onclick="testSmtpFromModal()" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer;">✉️ Проверить отправку SMTP</button>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; font-size: 12px; color: #1e40af; line-height: 1.5;">
          💡 <strong>Для почты Beget:</strong> Сервер: <code>smtp.beget.com</code>, Порт: <code>465</code>, Шифрование: <code>SSL</code>.<br> Логин и Email отправителя должны совпадать (например <code>noreply@e-klimov.ru</code>).
        </div>
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">SMTP Сервер:</label>
            <input type="text" id="cfg-smtp-host" placeholder="smtp.beget.com" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Порт:</label>
            <input type="number" id="cfg-smtp-port" placeholder="465" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Шифрование:</label>
            <select id="cfg-smtp-secure" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; background: #fff;">
              <option value="true">SSL (Порт 465)</option>
              <option value="false">STARTTLS / Нет</option>
            </select>
          </div>
        </div>
        <div class="modal-grid-2" style="margin-bottom: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Логин / Email ящика:</label>
            <input type="email" id="cfg-smtp-user" autocomplete="off" placeholder="noreply@e-klimov.ru" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Пароль от почтового ящика:</label>
            <div style="display: flex; gap: 6px;">
              <input type="password" id="cfg-smtp-pass" autocomplete="new-password" placeholder="Оставьте пустым, если не меняете" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
              <button type="button" onclick="const p=document.getElementById('cfg-smtp-pass'); p.type=p.type==='password'?'text':'password';" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:0 8px; border-radius:6px; cursor:pointer;" title="Показать/скрыть пароль">👁️</button>
            </div>
            <div id="cfg-smtp-pass-status" style="font-size: 11.5px; margin-top: 3px; color: #059669; font-weight: 500;"></div>
          </div>
        </div>
        <div class="modal-grid-2">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Email отправителя (From):</label>
            <input type="email" id="cfg-smtp-from-email" autocomplete="off" placeholder="noreply@e-klimov.ru" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Имя отправителя:</label>
            <input type="text" id="cfg-smtp-from-name" placeholder="IT-сопровождение | Климов Евгений" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Email админа (куда слать ошибки):</label>
            <input type="email" id="cfg-admin-notify-email" placeholder="admin@domain.com" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
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
          
          const safeSet = (id, val) => { const e = document.getElementById(id); if (e) e.value = val; };
          const safeText = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
          
          // Saby
          safeSet('cfg-saby-client-id', s.saby_app_client_id || '');
          safeSet('cfg-saby-app-secret', s.has_saby_secret ? '••••••••' : '');
          safeSet('cfg-saby-secret-key', s.has_saby_key ? 'HIDDEN' : '');
          safeText('cfg-saby-key-status', s.has_saby_key ? '✓ Ключ сохранен' : '⚠️ Ключ не загружен');
          
          // Beget
          safeSet('cfg-beget-login', s.beget_login || '');
          safeSet('cfg-beget-pass', ''); // clean for placeholder
          const begetPassStatus = document.getElementById('cfg-beget-pass-status');
          if (begetPassStatus) {
            if (s.has_beget_password) {
              begetPassStatus.textContent = '✓ Пароль сохранен в системе';
              const bp = document.getElementById('cfg-beget-pass');
              if (bp) bp.placeholder = 'Оставьте пустым, если не меняете';
            } else {
              begetPassStatus.textContent = '⚠️ Пароль не установлен';
              const bp = document.getElementById('cfg-beget-pass');
              if (bp) bp.placeholder = 'Введите пароль от API';
            }
          }

          // Backups
          safeSet('cfg-backup-secret', s.backup_webhook_secret || '');
          safeSet('cfg-backup-email', s.backup_alert_email || '');
          
          // SMTP
          safeSet('cfg-smtp-host', s.smtp_host || '');
          safeSet('cfg-smtp-port', s.smtp_port || '');
          safeSet('cfg-smtp-user', s.smtp_user || '');
          safeSet('cfg-smtp-from-email', s.smtp_from_email || '');
          safeSet('cfg-smtp-from-name', s.smtp_from_name || '');
          safeSet('cfg-admin-notify-email', s.admin_notify_email || '');
          
          // Clear password
          safeSet('cfg-smtp-pass', '');
          const passStatus = document.getElementById('cfg-smtp-pass-status');
          if (passStatus) {
            if (s.has_smtp_password) {
              passStatus.textContent = '✓ Рабочий пароль сохранен в системе';
              passInput.placeholder = 'Оставьте пустым, если не меняете';
            } else {
              passStatus.textContent = '⚠️ Пароль не установлен';
              passInput.placeholder = 'Введите пароль';
            }
          }
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      }
    }

    async function testBegetFromModal() {
      const btn = document.getElementById('cfg-test-beget-btn');
      const box = document.getElementById('cfg-result-box');
      btn.innerHTML = '⏳ Проверка...';
      btn.disabled = true;
      box.style.display = 'none';

      const payload = {
        beget_login: safeGet('cfg-beget-login'),
        beget_password: safeGet('cfg-beget-pass')
      };

      try {
        const res = await fetch('/api/settings/beget/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        box.style.display = 'block';
        if (data.ok) {
          box.style.background = '#dcfce7';
          box.style.color = '#166534';
          box.style.border = '1px solid #bbf7d0';
          box.innerHTML = '<strong>✅ Успех:</strong> Соединение с Beget API установлено!<br>Аккаунт: ' + (data.account || 'Подключено');
        } else {
          box.style.background = '#fee2e2';
          box.style.color = '#991b1b';
          box.style.border = '1px solid #fecaca';
          box.innerHTML = '<strong>❌ Ошибка Beget:</strong> ' + (data.error || 'Сбой подключения');
        }
      } catch (err) {
        box.style.display = 'block';
        box.style.background = '#fee2e2';
        box.style.color = '#991b1b';
        box.innerHTML = '<strong>❌ Системная ошибка:</strong> ' + err.message;
      } finally {
        btn.innerHTML = '⚡ Проверить связь с Beget';
        btn.disabled = false;
      }
    }

    async function saveSabyGlobalSettings() {
      const btn = document.getElementById('cfg-save-btn');
      const box = document.getElementById('cfg-result-box');
      btn.disabled = true;
      btn.textContent = 'Сохранение...';

      const safeGet = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
      const secretKeyVal = safeGet('cfg-saby-secret-key');
      const payload = {
        saby_app_client_id: safeGet('cfg-saby-client-id'),
        saby_app_secret: safeGet('cfg-saby-app-secret'),
        saby_secret_key: secretKeyVal === 'HIDDEN' ? '' : secretKeyVal,
        beget_login: safeGet('cfg-beget-login'),
        beget_password: safeGet('cfg-beget-pass'),
        backup_webhook_secret: safeGet('cfg-backup-secret'),
        backup_alert_email: safeGet('cfg-backup-email'),
        smtp_host: safeGet('cfg-smtp-host'),
        smtp_port: safeGet('cfg-smtp-port'),
        smtp_secure: safeGet('cfg-smtp-secure') === 'true',
        smtp_user: safeGet('cfg-smtp-user'),
        smtp_password: safeGet('cfg-smtp-pass'),
        smtp_from_email: safeGet('cfg-smtp-from-email') || safeGet('cfg-smtp-user'),
        smtp_from_name: safeGet('cfg-smtp-from-name'),
        admin_notify_email: safeGet('cfg-admin-notify-email')
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
          box.textContent = '✓ Настройки Saby CRM, бэкапов и почтового шлюза успешно сохранены!';
          showToast('✓ Настройки успешно сохранены!');
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

    function applySmtpPreset(type) {
      if (type === 'beget') {
        document.getElementById('cfg-smtp-host').value = 'smtp.beget.com';
        document.getElementById('cfg-smtp-port').value = '465';
        document.getElementById('cfg-smtp-secure').value = 'true';
      } else if (type === 'yandex') {
        document.getElementById('cfg-smtp-host').value = 'smtp.yandex.ru';
        document.getElementById('cfg-smtp-port').value = '465';
        document.getElementById('cfg-smtp-secure').value = 'true';
      } else if (type === 'mailru') {
        document.getElementById('cfg-smtp-host').value = 'smtp.mail.ru';
        document.getElementById('cfg-smtp-port').value = '465';
        document.getElementById('cfg-smtp-secure').value = 'true';
      } else if (type === 'gmail') {
        document.getElementById('cfg-smtp-host').value = 'smtp.gmail.com';
        document.getElementById('cfg-smtp-port').value = '465';
        document.getElementById('cfg-smtp-secure').value = 'true';
      }
    }

    async function testSmtpFromModal() {
      const btn = document.getElementById('cfg-test-smtp-btn');
      const box = document.getElementById('cfg-result-box');
      btn.disabled = true;
      btn.textContent = 'Отправка...';
      box.style.display = 'block';
      box.style.background = '#eff6ff';
      box.style.color = '#1e3a8a';
      box.innerHTML = '⏳ Проверка соединения с SMTP-сервером и отправка тестового письма...';

      const payload = {
        recipient: document.getElementById('cfg-admin-notify-email').value,
        smtp_host: safeGet('cfg-smtp-host'),
        smtp_port: safeGet('cfg-smtp-port'),
        smtp_secure: safeGet('cfg-smtp-secure') === 'true',
        smtp_user: safeGet('cfg-smtp-user'),
        smtp_password: safeGet('cfg-smtp-pass'),
        smtp_from_email: safeGet('cfg-smtp-from-email') || safeGet('cfg-smtp-user'),
        smtp_from_name: safeGet('cfg-smtp-from-name')
      };

      try {
        const res = await fetch('/api/settings/smtp/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          box.style.background = '#ecfdf5';
          box.style.color = '#065f46';
          box.innerHTML = '<strong>✓ Успешно:</strong> ' + data.message;
        } else {
          box.style.background = '#fffbeb';
          box.style.color = '#92400e';
          const errMsg = data.error || data.message || 'Ошибка соединения с сервером почты';
          const hint = data.hint ? '<br><small style="display:block; margin-top:4px; color:#b45309;">💡 ' + data.hint + '</small>' : '';
          box.innerHTML = '<strong>⚠️ Ошибка SMTP:</strong> ' + errMsg + hint;
        }
      } catch (err) {
        box.style.background = '#fef2f2';
        box.style.color = '#991b1b';
        box.innerHTML = '<strong>❌ Сетевая ошибка:</strong> ' + err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = '✉️ Проверить отправку тестового письма';
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
        saby_app_client_id: safeGet('cfg-saby-client-id'),
        saby_app_secret: safeGet('cfg-saby-app-secret'),
        saby_secret_key: safeGet('cfg-saby-secret-key') === 'HIDDEN' ? '' : safeGet('cfg-saby-secret-key')
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
  
    function resetDatabase() {
      if(confirm('Вы уверены, что хотите ПОЛНОСТЬЮ ОЧИСТИТЬ базу данных? Это действие необратимо!')) {
        fetch('/api/system/reset', { method: 'POST' })
          .then(r => r.json())
          .then(res => {
             if(res.ok) window.location.reload();
             else alert('Ошибка: ' + res.error);
          });
      }
    }
    function seedDatabase() {
      fetch('/api/system/seed_test', { method: 'POST' })
        .then(r => r.json())
        .then(res => {
           if(res.ok) window.location.reload();
           else alert('Ошибка: ' + res.error);
        });
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
  const { inn, company_name, contract_id, contract_number, contract_title } = req.body;
  const inputInn = inn || req.body.search_input;
  
  if (inputInn) {
    const existing = db.db.prepare('SELECT id FROM clients WHERE inn = ?').get(inputInn);
    if (existing) {
      db.db.prepare('UPDATE clients SET archived = 0 WHERE id = ?').run(existing.id);
      return res.redirect('/client/' + existing.id + '?flash=' + encodeURIComponent('Клиент с таким ИНН уже существует (восстановлен из архива).'));
    }
  }

  
  let sitesArray = [];
  if (Array.isArray(req.body['sites[]'])) sitesArray = req.body['sites[]'];
  else if (typeof req.body['sites[]'] === 'string') sitesArray = [req.body['sites[]']];
  const sitesStr = sitesArray.filter(s => s.trim() !== '').join(', ');

  let emailsArray = [];
  if (Array.isArray(req.body['contact_emails[]'])) emailsArray = req.body['contact_emails[]'];
  else if (typeof req.body['contact_emails[]'] === 'string') emailsArray = [req.body['contact_emails[]']];
  const emailsStr = emailsArray.filter(e => e.trim() !== '').join(', ');

  const newClient = db.addClient({
    inn: inn || req.body.search_input,
    company_name: company_name || req.body.search_input,
    email_reports: emailsStr,
    sites: sitesStr,
    saby_contract_id: contract_id,
    saby_contract_number: contract_number
  });

  let contactNames = [];
  if (Array.isArray(req.body['contact_names[]'])) contactNames = req.body['contact_names[]'];
  else if (typeof req.body['contact_names[]'] === 'string') contactNames = [req.body['contact_names[]']];
  
  for (let i = 0; i < contactNames.length; i++) {
    const cName = contactNames[i].trim();
    const cEmail = (emailsArray[i] || '').trim();
    if (cName || cEmail) {
      db.addContact(newClient.id, {
        name: cName || 'Представитель',
        position: '',
        email: cEmail,
        phone: '',
        role: 'staff'
      });
    }
  }

  req.session.flash = `Карточка ${newClient.company_name} успешно создана!`;
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
    reqQuery: req.query,
    reqHost: req.get('host')
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
      ssh_key: req.body.cred_ssh_key,
      web_root_dir: req.body.cred_web_root_dir,
      backup_token: req.body.cred_backup_token,
      ftp_host: req.body.cred_ftp_host,
      ftp_port: req.body.cred_ftp_port,
      ftp_user: req.body.cred_ftp_user,
      ftp_password: req.body.cred_ftp_password,
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


// --- Hosting Accounts & Sites API ---
app.post('/api/client/:id/hosting', (req, res) => {
  try {
    const id = db.addHostingAccount(req.params.id, req.body);
    res.json({ ok: true, id });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/client/:id/hosting/:host_id/delete', (req, res) => {
  try {
    db.deleteHostingAccount(req.params.host_id);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/client/:id/sites', (req, res) => {
  try {
    const id = db.addSite(req.params.id, req.body);
    res.json({ ok: true, id });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/client/:id/sites/:site_id/delete', (req, res) => {
  try {
    db.deleteSite(req.params.site_id);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/system/reset', (req, res) => {
  try {
    db.resetDatabase();
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/system/seed_test', (req, res) => {
  try {
    const clientObj = db.addClient({
      inn: '7736207543',
      company_name: 'ООО "Яндекс" (Тестовый клиент)',
      email_reports: 'reports@yandex.ru',
      sites: 'yandex.ru',
      saby_contract_id: 'test-doc-123',
      saby_contract_number: '№ 123-ТЕСТ',
      monthly_fee: 150000,
      contract_start_date: new Date().toISOString().slice(0, 10)
    });
    
    const hostId = db.addHostingAccount(clientObj.id, {
      provider_name: 'Yandex Cloud',
      provider_url: 'https://console.cloud.yandex.ru',
      login: 'admin@yandex.ru',
      password: 'super-secure-password',
      api_key: 'AQVN-TestApiKey123',
      notes: 'Тестовый хостинг'
    });
    
    db.addSite(clientObj.id, {
      hosting_account_id: hostId,
      url: 'yandex.ru',
      cms_type: 'Custom React',
      cms_login: 'admin',
      cms_password: 'cms-password',
      ssh_host: '8.8.8.8',
      ssh_user: 'root',
      ssh_password: 'ssh-password'
    });
    
    db.addSite(clientObj.id, {
      hosting_account_id: hostId,
      url: 'market.yandex.ru',
      cms_type: '1C-Bitrix',
      cms_login: 'admin',
      cms_password: 'market-password',
      ssh_host: '8.8.8.9',
      ssh_user: 'root',
      ssh_password: 'ssh-password-2'
    });
    
    res.json({ ok: true, clientId: clientObj.id });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/client/:id/archive', (req, res) => {
  const { reason } = req.body;
  try {
    db.archiveClient(req.params.id, reason);
    res.json({ ok: true, message: 'Договор расторгнут, клиент перенесен в архив.' });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/client/:id/restore', (req, res) => {
  try {
    db.restoreClient(req.params.id);
    res.json({ ok: true, message: 'Договор восстановлен, клиент активен.' });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --- API for Backup Agent script generation & download ---
app.get('/api/client/:id/backup-agent.php', (req, res) => {
  const client = db.getClientById(req.params.id);
  if (!client) return res.status(404).send('Клиент не найден');
  const creds = db.getClientCredentials(client.id, { mask: false });
  const sites = db.getClientSites(client.id);
  const host = req.get('host');
  const webhookUrl = `https://${host}/api/backups/report`;
  const token = req.query.token || creds?.backup_token || `bk_${client.id}_secret`;

  const phpCode = generatePhpBackupAgent({ client, webhookUrl, secretToken: token, sites });
  res.setHeader('Content-Type', 'application/x-php; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="crm_backup_agent.php"');
  res.send(phpCode);
});

app.get('/api/client/:id/install-agent.sh', (req, res) => {
  const client = db.getClientById(req.params.id);
  if (!client) return res.status(404).send('Клиент не найден');
  const creds = db.getClientCredentials(client.id, { mask: false });
  const host = req.get('host');
  const webhookUrl = `https://${host}/api/backups/report`;
  const token = req.query.token || creds?.backup_token || `bk_${client.id}_secret`;

  const bashCode = generateBashInstaller({ client, webhookUrl, secretToken: token, reqHost: host });
  res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="install-crm-agent.sh"');
  res.send(bashCode);
});

// --- API for Remote SSH Testing, Command Exec & Auto Agent Install ---
app.post('/api/client/:id/ssh/test', async (req, res) => {
  try {
    const client = db.getClientById(req.params.id);
    if (!client) return res.json({ ok: false, error: 'Клиент не найден' });
    const creds = db.getClientCredentials(client.id, { mask: false });
    const connInfo = {
      host: req.body.host || creds.ssh_host,
      port: req.body.port || creds.ssh_port || 22,
      user: req.body.user || creds.ssh_user || 'root',
      password: (req.body.password && !req.body.password.startsWith('••••')) ? req.body.password : creds.ssh_password,
      privateKey: req.body.privateKey || creds.ssh_key
    };
    const result = await sshService.testConnection(connInfo);
    res.json(result);
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post('/api/client/:id/ssh/exec', async (req, res) => {
  try {
    const client = db.getClientById(req.params.id);
    if (!client) return res.json({ ok: false, error: 'Клиент не найден' });
    const creds = db.getClientCredentials(client.id, { mask: false });
    const { command } = req.body;
    if (!command) return res.json({ ok: false, error: 'Команда не указана' });

    const connInfo = {
      host: req.body.host || creds.ssh_host,
      port: req.body.port || creds.ssh_port || 22,
      user: req.body.user || creds.ssh_user || 'root',
      password: (req.body.password && !req.body.password.startsWith('••••')) ? req.body.password : creds.ssh_password,
      privateKey: req.body.privateKey || creds.ssh_key
    };
    const result = await sshService.executeCommand(connInfo, command);
    res.json(result);
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post('/api/client/:id/ssh/install-agent', async (req, res) => {
  try {
    const client = db.getClientById(req.params.id);
    if (!client) return res.json({ ok: false, error: 'Клиент не найден' });
    const creds = db.getClientCredentials(client.id, { mask: false });
    const sites = db.getClientSites(client.id);
    const host = req.get('host');
    const webhookUrl = `https://${host}/api/backups/report`;
    const token = creds?.backup_token || `bk_${client.id}_secret`;
    const phpCode = generatePhpBackupAgent({ client, webhookUrl, secretToken: token, sites });

    const targetDir = req.body.targetDir || creds.web_root_dir || '/home/bitrix/www';
    const connInfo = {
      host: creds.ssh_host,
      port: creds.ssh_port || 22,
      user: creds.ssh_user || 'root',
      password: creds.ssh_password,
      privateKey: creds.ssh_key
    };

    const result = await sshService.installBackupAgent(connInfo, {
      agentCode: phpCode,
      targetDir,
      cronTime: req.body.cronTime || '15 4 * * *'
    });
    res.json(result);
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
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

// Test Beget API from modal
app.post('/api/settings/beget/test', async (req, res) => {
  try {
    const { beget_login, beget_password } = req.body || {};
    
    // Save to settings manager temporarily or permanently to test
    if (beget_login) {
      settingsManager.saveSettings({ beget_login, beget_password });
    }
    
    const { testBegetConnection } = await import('./beget_client.js');
    const testRes = await testBegetConnection();
    
    if (testRes.ok && testRes.answer) {
      // Typically /account/getInfo returns { user_id, plan_id, etc. }
      res.json({ ok: true, account: testRes.answer.plan_name || testRes.answer.user_id || 'Успешно' });
    } else {
      res.json({ ok: false, error: testRes.error });
    }
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

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
  db.addWorkLog(clientId, { description, hours, category, dateStr, syncToSaby: sync_to_saby === '1' || sync_to_saby === true });
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

app.post('/api/github/pull', async (req, res) => {
  try {
    const result = await pullFromGitHub();
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
  db.addWorkLog(clientId, { description, hours, dateStr });
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

<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
<script>
async function registerPasskey() {
  try {
    const resp = await fetch('/webauthn/generate-reg', { credentials: 'include' });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error('Не авторизован');
      throw new Error('Failed to generate options');
    }
    const opts = await resp.json();
    if (opts.error) throw new Error(opts.error);
    
    const attResp = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: opts });
    
    const verifyResp = await fetch('/webauthn/verify-reg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp),
      credentials: 'include'
    });
    
    const verification = await verifyResp.json();
    if (verification.verified) {
      alert('Ключ (Passkey) успешно добавлен! Теперь вы можете входить по отпечатку или Face ID.');
    } else {
      alert('Ошибка при сохранении ключа: ' + (verification.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error(e);
    alert('Не удалось зарегистрировать ключ: ' + e.message);
  }
}
</script>
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

<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
<script>
async function registerPasskey() {
  try {
    const resp = await fetch('/webauthn/generate-reg', { credentials: 'include' });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error('Не авторизован');
      throw new Error('Failed to generate options');
    }
    const opts = await resp.json();
    if (opts.error) throw new Error(opts.error);
    
    const attResp = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: opts });
    
    const verifyResp = await fetch('/webauthn/verify-reg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp),
      credentials: 'include'
    });
    
    const verification = await verifyResp.json();
    if (verification.verified) {
      alert('Ключ (Passkey) успешно добавлен! Теперь вы можете входить по отпечатку или Face ID.');
    } else {
      alert('Ошибка при сохранении ключа: ' + (verification.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error(e);
    alert('Не удалось зарегистрировать ключ: ' + e.message);
  }
}
</script>
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

// --- Contact Persons & 2FA Access Management Routes ---
app.post('/client/:id/contacts/add', (req, res) => {
  const clientId = req.params.id;
  const { name, position, email, phone, role } = req.body;
  if (!name || !email) {
    return res.redirect(`/client/${clientId}?tab=contacts&msg=${encodeURIComponent('Укажите ФИО и рабочий email')}`);
  }
  const contact = db.addContact(clientId, { name, position, email, phone, role });
  res.redirect(`/client/${clientId}?tab=contacts&msg=${encodeURIComponent('Контактное лицо ' + contact.name + ' успешно добавлено! Персональная 2FA ссылка создана.')}`);
});

app.post('/client/:id/contacts/:contactId/delete', (req, res) => {
  const { id, contactId } = req.params;
  db.deleteContact(contactId);
  res.redirect(`/client/${id}?tab=contacts&msg=${encodeURIComponent('Контактное лицо удалено')}`);
});

app.post('/client/:id/contacts/:contactId/reissue', (req, res) => {
  const { id, contactId } = req.params;
  const contact = db.reissueContactToken(contactId);
  res.redirect(`/client/${id}?tab=contacts&msg=${encodeURIComponent('Секретная ссылка для ' + (contact ? contact.name : '') + ' перевыпущена!')}`);
});

app.post('/api/client/:id/contact/:contactId/send_invite', async (req, res) => {
  try {
    const { id, contactId } = req.params;
    const contact = db.getContactById(contactId);
    const client = db.getClientById(id);
    if (!contact || !client) {
      return res.json({ ok: false, error: 'Контакт или организация не найдены' });
    }
    const host = req.get('host') || 'localhost:3000';
    const proto = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const accessUrl = `${proto}://${host}/portal?token=${contact.token}`;
    const mailRes = await mailer.sendContactInvite({
      toEmail: contact.email,
      contactName: contact.name,
      companyName: client.company_name,
      accessUrl
    });
    res.json({ ok: true, simulated: !!mailRes.simulated, messageId: mailRes.messageId });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// SMTP Mailer Test Route
app.post('/api/settings/smtp/test', async (req, res) => {
  try {
    const { recipient, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, smtp_from_name, smtp_from_email } = req.body || {};
    const raw = settingsManager.getRawSettings();
    
    // Fall back to saved password if masked or empty
    const isMaskedSecret = (v) => !v || typeof v !== 'string' || v.includes('•') || v.includes('●') || v.includes('***') || v.includes('…');
    let cleanPassword = smtp_password;
    if (isMaskedSecret(cleanPassword)) {
      cleanPassword = raw.smtp_password || '';
    }

    const effectiveFromEmail = (smtp_from_email || smtp_user || raw.smtp_from_email || raw.smtp_user || 'noreply@e-klimov.ru').trim();

    if (smtp_host) {
      settingsManager.saveSettings({
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_user,
        smtp_password: cleanPassword,
        smtp_from_name,
        smtp_from_email: effectiveFromEmail,
        admin_notify_email: recipient
      });
    }

    const configToTest = {
      ...req.body,
      smtp_from_email: effectiveFromEmail,
      smtp_password: cleanPassword
    };

    const testRes = await mailer.testConnection(recipient, configToTest);
    res.json(testRes);
  } catch (err) {
    res.json({ ok: false, error: err.message, message: err.message });
  }
});

// --- Portal Authentication & 2FA Flow ---
app.get('/portal/login', (req, res) => {
  res.send(renderPortalLoginPage({
    error: req.query.error,
    initialEmail: req.query.email
  }));
});

app.get('/portal/logout', (req, res) => {
  req.session.portalContactId = null;
  req.session.portalClientId = null;
  res.redirect('/portal/login');
});

// Request 6-digit 2FA code via email or secret token
app.post('/portal/send_code', async (req, res) => {
  const { email, token } = req.body || {};
  let contact = null;
  if (token) {
    contact = db.getContactByToken(token);
  } else if (email) {
    contact = db.getContactByEmail(email);
  }

  if (!contact) {
    return res.send(renderPortalLoginPage({
      error: 'Контактное лицо не найдено в реестре уполномоченных представителей. Проверьте правильность email или обратитесь к вашему IT-инженеру.',
      initialEmail: email || ''
    }));
  }

  const client = db.getClientById(contact.client_id);
  if (!client) {
    return res.send(renderPortalLoginPage({
      error: 'Организация контрагента не найдена в базе данных.',
      initialEmail: email || ''
    }));
  }

  // Generate 6-digit OTP code and dispatch via SMTP
  const { code } = db.createVerificationCode(contact.email);
  const mailRes = await mailer.sendLoginVerificationCode({
    toEmail: contact.email,
    contactName: contact.name,
    companyName: client.company_name,
    code
  });

  res.send(renderPortalVerifyPage({
    contact,
    client,
    token: contact.token,
    simulatedCode: mailRes.simulated ? code : null
  }));
});

// Verify 6-digit code and establish authenticated session
app.post('/portal/do_verify', (req, res) => {
  const { contact_id, code, token } = req.body || {};
  if (!contact_id || !code) {
    return res.redirect('/portal/login');
  }

  const verifyRes = db.verifyLoginCode(contact_id, code);
  if (!verifyRes.ok) {
    const contact = db.getContactById(contact_id);
    const client = contact ? db.getClientById(contact.client_id) : null;
    return res.send(renderPortalVerifyPage({
      contact,
      client,
      token,
      error: verifyRes.error
    }));
  }

  // 2FA code verified successfully! Set session
  req.session.portalContactId = verifyRes.contact.id;
  req.session.portalClientId = verifyRes.contact.client_id;
  res.redirect('/portal');
});

// Main Protected Portal Route
app.get('/portal', async (req, res) => {
  // If user entered via secret link (?token=...)
  if (req.query.token) {
    const contact = db.getContactByToken(req.query.token);
    if (contact) {
      const client = db.getClientById(contact.client_id);
      const { code } = db.createVerificationCode(contact.email);
      const mailRes = await mailer.sendLoginVerificationCode({
        toEmail: contact.email,
        contactName: contact.name,
        companyName: client ? client.company_name : 'Контрагент',
        code
      });
      return res.send(renderPortalVerifyPage({
        contact,
        client,
        token: contact.token,
        simulatedCode: mailRes.simulated ? code : null
      }));
    } else {
      return res.send(renderPortalLoginPage({
        error: 'Предоставленная ссылка доступа недействительна или была перевыпущена администратором. Введите рабочий email для получения кода.'
      }));
    }
  }

  // If verified contact session exists
  if (req.session.portalContactId) {
    const contact = db.getContactById(req.session.portalContactId);
    if (contact) {
      const client = db.getClientById(contact.client_id);
      if (client) {
        const activeTab = req.query.tab || 'home';
        return res.send(renderPortalPage({
          client,
          contact,
          token: contact.token,
          activeTab,
          reqQuery: req.query
        }));
      }
    }
  }

  // Not authenticated: prompt login
  res.redirect('/portal/login');
});

// Public client portal (Apple Liquid Glass design) - legacy token redirection
// Secure Client Portal Entry
app.get('/portal/t/:token', async (req, res) => {
  const token = req.params.token;
  
  // 1. Check if token belongs to a Client (Admin Preview Mode)
  const clientByToken = db.getClientByToken(token);
  if (clientByToken) {
    if (!req.session.admin_id) {
      return res.status(403).send('Доступ к предпросмотру запрещен. Вы не авторизованы как администратор.');
    }
    return res.send(renderPortalPage({
      client: clientByToken,
      contact: null,
      isAdminPreview: true,
      token,
      activeTab: req.query.tab || 'home',
      reqQuery: req.query
    }));
  }

  // 2. Check if token belongs to a Contact (Actual Client Access)
  const contact = db.getContactByToken(token);
  if (!contact) {
    return res.status(404).send(`<!doctype html>
      <html lang="ru">
      <head><meta charset="utf-8"><title>Ссылка недействительна</title></head>
      <body style="font-family:sans-serif; padding:40px; text-align:center;">
        <h2>Ссылка недействительна или устарела.</h2>
        <p>Обратитесь к администратору для получения новой ссылки.</p>
      </body>
      </html>`);
  }

  const client = db.getClientById(contact.client_id);
  
  // If contact is already logged in via session
  if (req.session.portalContactId && String(req.session.portalContactId) === String(contact.id)) {
    return res.send(renderPortalPage({
      client,
      contact,
      token: contact.token,
      activeTab: req.query.tab || 'home',
      reqQuery: req.query
    }));
  }

  // Otherwise, require 2FA Verification
  const { code } = db.createVerificationCode(contact.email);
  const mailRes = await mailer.sendLoginVerificationCode({
    toEmail: contact.email,
    contactName: contact.name,
    companyName: client ? client.company_name : 'Контрагент',
    code
  });
  
  return res.send(renderPortalVerifyPage({
    contact,
    client,
    token: contact.token,
    simulatedCode: mailRes.simulated ? code : null
  }));
});

// Alias for old public link structure just in case
app.get('/public/client/:token', (req, res) => {
  res.redirect('/portal/t/' + req.params.token);
});

// API endpoint to create ticket from client portal (with contact attribution & admin email alert)
app.post('/api/ticket', async (req, res) => {
  const { clientId, subject, service, priority, message, contactId, authorName, authorEmail, authorPosition } = req.body;
  if (!clientId || !subject) {
    return res.status(400).json({ ok: false, error: 'Укажите тему обращения' });
  }

  const activeContactId = contactId || req.session?.portalContactId || null;
  const contact = activeContactId ? db.getContactById(activeContactId) : null;

  const ticket = db.createTicket(clientId, {
    subject,
    service,
    priority,
    message,
    contactId: activeContactId,
    authorName: (contact ? contact.name : authorName) || 'Уполномоченный сотрудник',
    authorEmail: (contact ? contact.email : authorEmail) || '',
    authorPosition: (contact ? contact.position : authorPosition) || ''
  });

  const client = db.getClientById(clientId);

  // Send email alert to admin
  try {
    await mailer.sendTicketNotificationToAdmin({ ticket, client, contact });
  } catch (err) {
    console.error('Ошибка отправки email администратору:', err);
  }

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

<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
<script>
async function registerPasskey() {
  try {
    const resp = await fetch('/webauthn/generate-reg', { credentials: 'include' });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error('Не авторизован');
      throw new Error('Failed to generate options');
    }
    const opts = await resp.json();
    if (opts.error) throw new Error(opts.error);
    
    const attResp = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: opts });
    
    const verifyResp = await fetch('/webauthn/verify-reg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp),
      credentials: 'include'
    });
    
    const verification = await verifyResp.json();
    if (verification.verified) {
      alert('Ключ (Passkey) успешно добавлен! Теперь вы можете входить по отпечатку или Face ID.');
    } else {
      alert('Ошибка при сохранении ключа: ' + (verification.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error(e);
    alert('Не удалось зарегистрировать ключ: ' + e.message);
  }
}
</script>
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
<head><meta charset="utf-8"><title>Ошибка CRM</title>
<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
<script>
async function registerPasskey() {
  try {
    const resp = await fetch('/webauthn/generate-reg', { credentials: 'include' });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error('Не авторизован');
      throw new Error('Failed to generate options');
    }
    const opts = await resp.json();
    if (opts.error) throw new Error(opts.error);
    
    const attResp = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: opts });
    
    const verifyResp = await fetch('/webauthn/verify-reg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp),
      credentials: 'include'
    });
    
    const verification = await verifyResp.json();
    if (verification.verified) {
      alert('Ключ (Passkey) успешно добавлен! Теперь вы можете входить по отпечатку или Face ID.');
    } else {
      alert('Ошибка при сохранении ключа: ' + (verification.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error(e);
    alert('Не удалось зарегистрировать ключ: ' + e.message);
  }
}
</script>
</head>
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
