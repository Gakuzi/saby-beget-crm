import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const changePassView = `app.get('/change-password', (req, res) => {`;
const changePassEnd = `res.redirect('/');\n});`;

const newChangePass = `app.get('/change-password', (req, res) => {
  res.send(\`<!DOCTYPE html>
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
</html>\`);
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
      const salt = require('crypto').randomBytes(16).toString('hex');
      const hash = require('crypto').pbkdf2Sync(new_password, salt, 1000, 64, 'sha512').toString('hex');
      db.db.prepare('UPDATE admin_users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, adminId);
    }
  } else {
    db.changePassword(new_password);
  }
  res.redirect('/');
});`;

const startIndex = code.indexOf(changePassView);
const endIndex = code.indexOf(changePassEnd) + changePassEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + newChangePass + code.substring(endIndex);
  fs.writeFileSync('server.js', code);
  console.log('Fixed change password');
} else {
  console.log('Could not find change password block');
}
