import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const target1 = `    <div class="header-bar" style="justify-content: center; position: relative;">
      <h2 style="font-weight: 800; font-size: 24px; text-align: center;">CRM-система управления договорами</h2>
      
      <!-- User / Settings Dropdown in top right -->
      <div style="position: absolute; right: 0; top: -5px;" class="user-dropdown-container">
        <button type="button" onclick="document.getElementById('user-menu').classList.toggle('show')" style="background: transparent; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <div style="width: 36px; height: 36px; background: #fdf2ee; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #b45309; font-weight: bold;">
            \${(req.session.crm_admin_user || 'К Е').substring(0,2).toUpperCase()}
          </div>
          <span style="font-weight: 600; color: #475569;">\${req.session.crm_admin_user || 'Климов Евгений'}</span>
          <span style="font-size: 10px; color: #94a3b8;">▼</span>
        </button>
        <div id="user-menu" style="display: none; position: absolute; right: 0; top: 45px; background: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 8px; width: 240px; z-index: 100; border: 1px solid #f1f5f9; padding: 8px 0;">
          <a href="/?filter=\${filter === 'active' ? 'archived' : 'active'}" style="display: block; padding: 10px 16px; color: #334155; text-decoration: none; font-size: 14px; border-bottom: 1px solid #f1f5f9;">\${filter === 'active' ? '🗄️ Показать архивные' : '📁 Показать активные'}</a>
            <a href="#" onclick="openSabySettingsModal()" style="display: block; padding: 10px 16px; color: #334155; text-decoration: none; font-size: 14px; border-bottom: 1px solid #f1f5f9;">⚙️ Настройки Saby CRM & Ключи</a>
          <a href="/change-password" style="display: block; padding: 10px 16px; color: #334155; text-decoration: none; font-size: 14px; border-bottom: 1px solid #f1f5f9;">🔑 Сменить пароль</a>
          <a href="#" onclick="resetDatabase()" style="display: block; padding: 10px 16px; color: #ef4444; text-decoration: none; font-size: 14px; border-bottom: 1px solid #f1f5f9;">⚠️ Сбросить всю БД</a>
          <a href="#" onclick="seedDatabase()" style="display: block; padding: 10px 16px; color: #10b981; text-decoration: none; font-size: 14px; border-bottom: 1px solid #f1f5f9;">🌱 Заполнить тестовым клиентом</a>
          <a href="/logout" style="display: block; padding: 10px 16px; color: #334155; text-decoration: none; font-size: 14px;">🚪 Выйти</a>
        </div>
      </div>
    </div>`;

const replace1 = `    <div class="header-bar">
      <h2 style="font-weight: 800; font-size: 24px;">CRM-система</h2>
      <div class="user-info" style="display:flex; align-items:center; gap:16px;">
        <span style="font-weight: 600; color: #475569;">👤 \${req.session.crm_admin_user || 'Администратор'}</span>
        <a href="/?filter=\${filter === 'active' ? 'archived' : 'active'}" style="font-size:13px; font-weight:600; color:#3b82f6;">\${filter === 'active' ? '🗄️ Архив' : '📁 Активные'}</a>
        <a href="/workers" style="font-size:13px; font-weight:600;">👥 Сотрудники</a>
        <a href="#" onclick="openSabySettingsModal()" style="font-size:13px; font-weight:600;">⚙️ Настройки</a>
        <a href="/logout" style="font-size:13px; font-weight:600; color:#ef4444;">🚪 Выйти</a>
      </div>
    </div>`;

code = code.replace(target1, replace1);

const target2 = `    <div class="actions-bar" style="justify-content: space-between;">
      <div style="display: flex; gap: 12px; position: relative;">
        <!-- Add Client Dropdown -->
        <button type="button" onclick="document.getElementById('add-menu').classList.toggle('show')" class="btn" style="padding: 10px 14px; font-size: 18px; border-radius: 50%; width: 44px; height: 44px; justify-content: center; box-shadow: 0 4px 12px rgba(255, 180, 162, 0.4);" title="Добавить клиента">
          +
        </button>
        <div id="add-menu" style="display: none; position: absolute; left: 0; top: 52px; background: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 8px; width: 260px; z-index: 100; border: 1px solid #f1f5f9; padding: 8px 0;">
          <a href="/add_page" style="display: block; padding: 10px 16px; color: #334155; text-decoration: none; font-size: 14px; border-bottom: 1px solid #f1f5f9;">🔍 Найти в базе данных / Saby</a>
          <a href="#" onclick="alert('Форма ручного добавления в разработке')" style="display: block; padding: 10px 16px; color: #334155; text-decoration: none; font-size: 14px; border-bottom: 1px solid #f1f5f9;">📝 Добавить вручную</a>
        </div>
      </div>
      <span style="font-size:13px; color:#94a3b8;">Всего контрагентов: \${clients.length}</span>
    </div>`;

const replace2 = `    <div class="actions-bar" style="justify-content: space-between;">
      <div style="display: flex; gap: 12px;">
        <a href="/add_page" class="btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; padding: 10px 18px; border-radius: 8px;">+ Добавить контрагента</a>
        <button type="button" onclick="seedDatabase()" class="btn" style="background: #f1f5f9; color: #475569; padding: 10px 18px; border-radius: 8px;">🌱 Сгенерировать тестового</button>
        <button type="button" onclick="resetDatabase()" class="btn" style="background: #fee2e2; color: #ef4444; padding: 10px 18px; border-radius: 8px;">⚠️ Сбросить БД</button>
      </div>
      <span style="font-size:13px; color:#94a3b8;">Всего контрагентов: \${clients.length}</span>
    </div>`;

code = code.replace(target2, replace2);

fs.writeFileSync('server.js', code);
