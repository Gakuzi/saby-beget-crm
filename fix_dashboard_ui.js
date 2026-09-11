import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

// Replace the buggy user dropdown and add menu with explicit buttons
code = code.replace(
  /      <!-- User \/ Settings Dropdown in top right -->[\s\S]*?<\/div>\s*<\/div>\s*<div class="actions-bar"/m,
  `      <div class="user-info">
        <span style="font-weight: 600; color: #475569;">👤 \${req.session.crm_admin_user || 'Администратор'}</span>
        <a href="/?filter=\${filter === 'active' ? 'archived' : 'active'}">\${filter === 'active' ? '🗄️ Архив' : '📁 Активные'}</a>
        <a href="/workers">👥 Сотрудники</a>
        <a href="#" onclick="openSabySettingsModal()">⚙️ Настройки Saby</a>
        <a href="/change-password">🔑 Пароль</a>
        <a href="/logout">🚪 Выйти</a>
      </div>
    </div>
    
    <div class="actions-bar"`
);

code = code.replace(
  /      <div style="display: flex; gap: 12px; position: relative;">[\s\S]*?<\/div>\s*<span style="font-size:13px; color:#94a3b8;">Всего/m,
  `      <div style="display: flex; gap: 12px;">
        <a href="/add_page" class="btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff;">+ Найти и Добавить из Saby</a>
      </div>
      <span style="font-size:13px; color:#94a3b8;">Всего`
);

// We need to remove the auto-closing dropdown script
code = code.replace(
  /    \/\/ Close dropdowns when clicking outside[\s\S]*?\}\);/m,
  ''
);

fs.writeFileSync('server.js', code);
