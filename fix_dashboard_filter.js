import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /const clients = db\.getClients\(\);/,
  "const filter = req.query.filter === 'archived' ? 'archived' : 'active';\n  const clients = db.getClients(filter);"
);

// Add a button/link to toggle the view on the dashboard header (near "Настройки Saby CRM")
code = code.replace(
  /<a href="#" onclick="openSabySettingsModal\(\)"/,
  `<a href="/?filter=\${filter === 'active' ? 'archived' : 'active'}" style="display: block; padding: 10px 16px; color: #334155; text-decoration: none; font-size: 14px; border-bottom: 1px solid #f1f5f9;">\${filter === 'active' ? '🗄️ Показать архивные' : '📁 Показать активные'}</a>
            <a href="#" onclick="openSabySettingsModal()"`
);

fs.writeFileSync('server.js', code);
