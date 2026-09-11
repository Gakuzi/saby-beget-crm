import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const loginUI = `
app.get('/login', (req, res) => {
  const msg = req.query.msg || '';
  const nextUrl = req.query.next || '/';
  res.send(\`<!doctype html>
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
</head>
<body>
  <div class="card">
    <h2>Вход в CRM</h2>
    \${msg ? \`<div class="\${req.query.type === 'success' ? 'success' : 'msg'}">\${msg}</div>\` : ''}
    
    <div class="tabs">
      <div class="tab active" onclick="switchTab('pwd')">По паролю</div>
      <div class="tab" onclick="switchTab('otp')">По E-mail (Код)</div>
    </div>

    <!-- Password Login Form -->
    <form id="form-pwd" method="post" action="/login">
      <input type="hidden" name="next" value="\${nextUrl}">
      <label>Email или Логин:</label>
      <input type="text" name="login" required placeholder="admin">
      <label>Пароль:</label>
      <input type="password" name="password" required placeholder="••••••••">
      <button type="submit">Войти</button>
    </form>

    <!-- OTP Request Form -->
    <form id="form-otp-req" method="post" action="/login_otp_request" style="display:none;">
      <input type="hidden" name="next" value="\${nextUrl}">
      <label>Email администратора:</label>
      <input type="email" name="email" required placeholder="eklimov84@gmail.com">
      <button type="submit">Получить код</button>
    </form>
    
    <!-- OTP Verify Form (if code was sent) -->
    \${req.query.show_otp ? \`
      <form id="form-otp-verify" method="post" action="/login_otp_verify" style="margin-top:20px; padding-top:20px; border-top:1px dashed #cbd5e1;">
        <input type="hidden" name="next" value="\${nextUrl}">
        <input type="hidden" name="email" value="\${req.query.email}">
        <label>Код из письма:</label>
        <input type="text" name="code" required placeholder="123456" style="letter-spacing:4px; text-align:center; font-weight:bold; font-size:18px;">
        <button type="submit" style="background:#10b981;">Подтвердить код</button>
      </form>
      <script>
        document.getElementById('form-pwd').style.display = 'none';
        document.getElementById('form-otp-req').style.display = 'none';
        document.querySelector('.tabs').style.display = 'none';
      </script>
    \` : ''}

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
    </script>
  </div>
</body>
</html>\`);
});

app.post('/login', (req, res) => {
  const { login, password, next } = req.body;
  const adminId = db.verifyAdminPassword(login, password);
  if (!adminId) {
    return res.redirect('/login?msg=' + encodeURIComponent('Неверный логин или пароль') + '&next=' + encodeURIComponent(next || '/'));
  }
  
  req.session.admin_id = adminId;
  const adminData = db.db.prepare('SELECT username, email FROM admin_users WHERE id = ?').get(adminId);
  req.session.crm_admin_user = adminData.username || adminData.email;
  
  res.redirect(next || '/');
});

const otps = new Map(); // Store OTPs in memory for simplicity

app.post('/login_otp_request', async (req, res) => {
  const { email, next } = req.body;
  
  // Check if admin exists
  const admin = db.db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email.trim());
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
  const admin = db.db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email.trim());
  
  req.session.admin_id = admin.id;
  req.session.crm_admin_user = admin.username || admin.email;
  
  db.updateAdminLastLogin(admin.id);
  
  res.redirect(next || '/');
});

// Workers Management
app.get('/workers', (req, res) => {
  const admins = db.db.prepare('SELECT id, username, email, created_at, last_login_at FROM admin_users ORDER BY id ASC').all();
  
  res.send(\`<!doctype html>
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
        \${admins.map(a => \`
          <tr>
            <td><strong>\${a.username}</strong></td>
            <td>\${a.email}</td>
            <td style="color:#64748b; font-size:13px;">\${a.last_login_at ? new Date(a.last_login_at).toLocaleString('ru-RU') : 'Никогда'}</td>
            <td>
              \${a.username !== 'admin' ? \`<a href="/workers/\${a.id}/delete" onclick="return confirm('Удалить сотрудника?');" style="color:#ef4444;">Удалить</a>\` : '<span style="color:#94a3b8;font-size:12px;">Системный</span>'}
            </td>
          </tr>
        \`).join('')}
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
</html>\`);
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

`;

// Replace existing old login GET/POST
code = code.replace(/app\.get\('\/login',[\s\S]*?app\.post\('\/login',[\s\S]*?\}\);/m, loginUI);

fs.writeFileSync('server.js', code);
