import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /\/\/ Admin Preview Mode \(opened from CRM control panel\)/,
  `// Check if Admin
  if (!req.session.admin_id && !req.session.portalContactId) {
    return res.status(403).send('Доступ запрещен. Требуется авторизация.');
  }
  
  // Admin Preview Mode (opened from CRM control panel)`
);

fs.writeFileSync('server.js', code);
