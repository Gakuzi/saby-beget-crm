import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const changePassPost = `app.post('/change-password', (req, res) => {
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
});`;

const oldChangePassRegex = /app\.post\('\/change-password'[\s\S]*?res\.redirect\('\/'\);\s*\}\);/;
code = code.replace(oldChangePassRegex, changePassPost);

fs.writeFileSync('server.js', code);
