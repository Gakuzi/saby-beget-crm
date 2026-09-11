import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const replacement = `  <div class="container" style="position: relative;">
    <div class="header-bar" style="justify-content: center; position: relative;">
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
          <a href="#" onclick="openSabySettingsModal()" style="display: block; padding: 10px 16px; color: #334155; text-decoration: none; font-size: 14px; border-bottom: 1px solid #f1f5f9;">⚙️ Настройки Saby CRM & Ключи</a>
          <a href="/change-password" style="display: block; padding: 10px 16px; color: #334155; text-decoration: none; font-size: 14px; border-bottom: 1px solid #f1f5f9;">🔑 Сменить пароль</a>
          <a href="#" onclick="resetDatabase()" style="display: block; padding: 10px 16px; color: #ef4444; text-decoration: none; font-size: 14px; border-bottom: 1px solid #f1f5f9;">⚠️ Сбросить всю БД</a>
          <a href="#" onclick="seedDatabase()" style="display: block; padding: 10px 16px; color: #10b981; text-decoration: none; font-size: 14px; border-bottom: 1px solid #f1f5f9;">🌱 Заполнить тестовым клиентом</a>
          <a href="/logout" style="display: block; padding: 10px 16px; color: #334155; text-decoration: none; font-size: 14px;">🚪 Выйти</a>
        </div>
      </div>
    </div>

    <div class="actions-bar" style="justify-content: space-between;">
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
        \${clients.map(c => \`
          <tr>
            <td>
              <strong>\${c.company_name}</strong><br>
              <small style="color:#64748b;">ИНН: \${c.inn}</small>
            </td>
            <td>
              \${c.saby_contract_number || '<span style="color:#94a3b8;">Не указан</span>'}
            </td>
            <td>\${c.sites || '<span style="color:#94a3b8;">—</span>'}</td>
            <td>
              \${c.beget_login
                ? \`<span class="badge badge-active">\${c.beget_login}</span>\`
                : \`<span class="badge">Не задан</span>\`}
            </td>
            <td style="text-align: right;">
              <div style="display: flex; justify-content: flex-end; gap: 8px;">
                <a href="/client/\${c.id}" class="card-link" style="background: #f1f5f9; color: #475569; font-size: 13px; padding: 6px 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; border-radius: 8px;">⚙️ Настройки</a>
                <a href="/portal/\${c.id}" target="_blank" class="card-link" style="background: #f8fafc; color: #6366f1; font-size: 13px; padding: 6px 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #e0e7ff; border-radius: 8px;">🖥️ Портал</a>
              </div>
            </td>
          </tr>
        \`).join('')}
      </tbody>
    </table>`;

code = code.replace(/  <div class="container">\s*<div class="header-bar">[\s\S]*?<\/table>/m, replacement);

const scriptToAdd = `
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
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(event) {
      if (!event.target.closest('.user-dropdown-container')) {
        const userMenu = document.getElementById('user-menu');
        if (userMenu && userMenu.classList.contains('show')) userMenu.classList.remove('show');
      }
      if (!event.target.closest('.actions-bar')) {
        const addMenu = document.getElementById('add-menu');
        if (addMenu && addMenu.classList.contains('show')) addMenu.classList.remove('show');
      }
    });
    </script>
`;

code = code.replace(/<\/script>(\s*)<\/body>/, match => scriptToAdd + '\n  </body>');
code = code.replace(/\.show { display: block !important; }/, '.show { display: block !important; }'); // ensure .show is ok

// Make sure we have the .show class
if (!code.includes('.show { display: block !important; }')) {
  code = code.replace(/<\/style>/, '  .show { display: block !important; }\n  </style>');
}

fs.writeFileSync('server.js', code);
