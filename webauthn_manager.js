import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const passkeysRoute = `
app.get('/passkeys', (req, res) => {
  if (!req.session.admin_id) return res.redirect('/login');
  const passkeys = db.getAdminPasskeys(req.session.admin_id);
  
  res.send(\`<!DOCTYPE html>
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
      \${passkeys.length === 0 ? '<p style="color:#64748b; font-size:14px;">У вас пока нет сохраненных ключей.</p>' : passkeys.map(pk => \`
        <div class="key-item">
          <div>
            <div style="font-weight:600; font-size:14px;">\${pk.device_type || 'Неизвестное устройство'}</div>
            <div style="font-size:11px; color:#94a3b8; font-family:monospace; margin-top:4px;">ID: \${pk.id.substring(0, 16)}...</div>
          </div>
          <form method="post" action="/passkeys/delete" style="margin:0;">
            <input type="hidden" name="id" value="\${pk.id}">
            <button type="submit" style="background:#fee2e2; color:#ef4444; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600; font-size:12px;">Удалить</button>
          </form>
        </div>
      \`).join('')}
    </div>
    <button type="button" onclick="registerPasskey()" style="width:100%; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#fff; border:none; padding:12px; border-radius:8px; font-weight:700; cursor:pointer; font-size:14px;">+ Добавить новый ключ (Отпечаток/FaceID)</button>
  </div>
</body>
</html>\`);
});

app.post('/passkeys/delete', (req, res) => {
  if (!req.session.admin_id) return res.status(401).send('Не авторизован');
  db.db.prepare('DELETE FROM admin_passkeys WHERE id = ? AND admin_id = ?').run(req.body.id, req.session.admin_id);
  res.redirect('/passkeys');
});
\n`;

// Insert before // Dashboard
code = code.replace("// Dashboard: List clients", passkeysRoute + "// Dashboard: List clients");
fs.writeFileSync('server.js', code);
