import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const replacement = `
    <div class="header-bar">
      <h2 style="font-weight: 800; font-size: 24px;">CRM-система</h2>
      <div class="user-info" style="display:flex; align-items:center; gap:16px;">
        <span style="font-weight: 600; color: #475569;">👤 \${req.session.crm_admin_user || 'Администратор'}</span>
        <a href="/?filter=\${filter === 'active' ? 'archived' : 'active'}" style="font-size:13px; font-weight:600; color:#3b82f6;">\${filter === 'active' ? '🗄️ Архив' : '📁 Активные'}</a>
        <a href="/workers" style="font-size:13px; font-weight:600;">👥 Сотрудники</a>
        <a href="#" onclick="openSabySettingsModal()" style="font-size:13px; font-weight:600;">⚙️ Настройки Saby</a>
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
      <span style="font-size:13px; color:#94a3b8;">Всего контрагентов: \${clients.length}</span>
    </div>
`;

// use a loose regex
code = code.replace(/<div class="header-bar"[\s\S]*?<table/m, replacement + '\n    <table');

fs.writeFileSync('server.js', code);
