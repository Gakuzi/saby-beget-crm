import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

const funcStartIndex = code.indexOf("export function renderNewClientPage() {");

const newCode = `export function renderNewClientPage() {
  return \`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Добавление контрагента | CRM</title>
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 10% 20%, rgba(238, 242, 255, 0.85) 0%, rgba(245, 243, 255, 0.8) 50%, rgba(248, 250, 252, 0.95) 100%);
      --glass-bg: rgba(255, 255, 255, 0.72);
      --glass-border: rgba(255, 255, 255, 0.8);
      --glass-shadow: 0 16px 40px 0 rgba(31, 38, 135, 0.08);
      --primary: #7c3aed;
      --primary-gradient: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      --text-main: #1e1b4b;
      --text-secondary: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      background: var(--bg-gradient);
      min-height: 100vh;
      color: var(--text-main);
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .glass-card {
      background: var(--glass-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 36px;
      box-shadow: var(--glass-shadow);
    }
    .form-group {
      margin-bottom: 20px;
      position: relative;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 6px;
    }
    .form-control {
      width: 100%;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      font-size: 14px;
      color: #1e293b;
      outline: none;
      transition: all 0.2s;
    }
    .form-control:focus {
      border-color: #7c3aed;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
    }
    .form-control:read-only {
      background: #f8fafc;
      color: #475569;
    }
    .btn-submit {
      background: var(--primary-gradient);
      color: #ffffff;
      padding: 13px 28px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
      transition: all 0.2s;
    }
    .btn-submit:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4);
    }
    .btn-add {
      background: #e0e7ff;
      color: #4338ca;
      border: none;
      border-radius: 8px;
      padding: 8px 12px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
    }
    .btn-add:hover { background: #c7d2fe; }
    .btn-remove {
      background: transparent;
      color: #ef4444;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 0 8px;
    }
    .dynamic-list-item {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
      align-items: center;
    }
    .suggest-box {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.15);
      z-index: 50;
      max-height: 280px;
      overflow-y: auto;
      margin-top: 4px;
      display: none;
    }
    .suggest-item {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f1f5f9;
      transition: background 0.15s;
    }
    .suggest-item:hover { background: #f8fafc; }
    .company-details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: rgba(255,255,255,0.5);
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 20px;
      margin-top: 16px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 16px;
      margin-top: 32px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" style="display:inline-flex; align-items:center; gap:8px; color:#5b21b6; font-weight:600; text-decoration:none; margin-bottom:20px;">
      &larr; Вернуться к списку контрагентов
    </a>

    <div class="glass-card">
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:24px;">
        <div style="width:48px; height:48px; border-radius:14px; background:var(--primary-gradient); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px;">
          🏢
        </div>
        <div>
          <h1 style="font-size:24px; font-weight:800; color:var(--text-main);">Новый клиент</h1>
          <p style="font-size:14px; color:var(--text-secondary); margin-top:2px;">
            Найдите организацию по ИНН или названию для автозаполнения данных
          </p>
        </div>
      </div>

      <form action="/add_client" method="POST" id="new-client-form">
        <input type="hidden" id="contract_id" name="contract_id">
        <input type="hidden" id="contract_number" name="contract_number">
        <input type="hidden" id="contract_title" name="contract_title">

        <!-- Search -->
        <div class="form-group" style="margin-bottom: 0;">
          <label>Быстрый поиск по базе Saby/ЕГРЮЛ:</label>
          <input type="text" id="search_input" class="form-control" placeholder="Введите ИНН или название компании..." oninput="searchCompany(this.value)" autocomplete="off">
          <div id="suggest-box" class="suggest-box"></div>
        </div>

        <!-- Populated Details -->
        <div id="company-details" class="company-details-grid">
          <div class="form-group" style="grid-column: span 2; margin-bottom: 0;">
            <label>Наименование (Полное или краткое):</label>
            <input type="text" id="company_name" name="company_name" class="form-control" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>ИНН:</label>
            <input type="text" id="inn" name="inn" class="form-control" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>КПП:</label>
            <input type="text" id="kpp" name="kpp" class="form-control">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>ОГРН:</label>
            <input type="text" id="ogrn" name="ogrn" class="form-control">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>Руководитель:</label>
            <input type="text" id="director" name="director" class="form-control">
          </div>
          <div class="form-group" style="grid-column: span 2; margin-bottom: 0;">
            <label>Юридический / Фактический адрес:</label>
            <input type="text" id="address" name="address" class="form-control">
          </div>
        </div>

        <div class="section-title">Синхронизация с Saby</div>
        <div class="form-group">
          <label>Привязка договора:</label>
          <select id="contract_select" class="form-control" onchange="onContractChange()">
            <option value="">Укажите контрагента для загрузки договоров...</option>
          </select>
        </div>

        <div class="section-title">Обслуживаемые сайты</div>
        <div id="sites-container">
          <div class="dynamic-list-item">
            <input type="text" name="sites[]" class="form-control" placeholder="example.com">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()" style="visibility:hidden">×</button>
          </div>
        </div>
        <button type="button" class="btn-add" onclick="addSiteField()">+ Добавить сайт</button>

        <div class="section-title">Контактные лица (Доступ в личный кабинет)</div>
        <div id="contacts-container">
          <div class="dynamic-list-item">
            <input type="text" name="contact_names[]" class="form-control" placeholder="Имя Фамилия" style="flex: 1;">
            <input type="email" name="contact_emails[]" class="form-control" placeholder="email@company.ru" style="flex: 1;">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()" style="visibility:hidden">×</button>
          </div>
        </div>
        <button type="button" class="btn-add" onclick="addContactField()">+ Добавить контакт</button>

        <div style="display:flex; justify-content:flex-end; gap:14px; margin-top:36px;">
          <a href="/" style="padding:12px 20px; font-weight:600; color:#64748b; text-decoration:none; display:inline-flex; align-items:center;">Отмена</a>
          <button type="submit" class="btn-submit">
            ✨ Сохранить клиента
          </button>
        </div>
      </form>
    </div>
  </div>

  <script>
    let searchTimer = null;
    function searchCompany(val) {
      clearTimeout(searchTimer);
      const box = document.getElementById('suggest-box');
      if (!val || val.length < 2) {
        box.style.display = 'none';
        return;
      }
      
      box.style.display = 'block';
      box.innerHTML = '<div class="suggest-item" style="color:#94a3b8; text-align:center;">Поиск в Saby...</div>';
      
      searchTimer = setTimeout(() => {
        fetch('/suggest_company?q=' + encodeURIComponent(val))
          .then(r => r.json())
          .then(items => {
            box.innerHTML = '';
            if (items && items.length > 0) {
              items.forEach(c => {
                const div = document.createElement('div');
                div.className = 'suggest-item';
                div.innerHTML = '<strong>' + c.name + '</strong> (ИНН: ' + c.inn + ')' +
                  (c.address ? '<br><small style="color:#64748b;">' + c.address + '</small>' : '');
                
                div.onclick = () => {
                  document.getElementById('search_input').value = c.name + ' (ИНН ' + c.inn + ')';
                  document.getElementById('company_name').value = c.name || '';
                  document.getElementById('inn').value = c.inn || '';
                  document.getElementById('kpp').value = c.kpp || '';
                  document.getElementById('ogrn').value = c.ogrn || '';
                  document.getElementById('director').value = c.director || '';
                  document.getElementById('address').value = c.address || '';
                  
                  box.style.display = 'none';
                  loadContracts(c.inn);
                };
                box.appendChild(div);
              });
            } else {
              box.innerHTML = '<div class="suggest-item" style="color:#94a3b8; text-align:center;">Ничего не найдено</div>';
            }
          });
      }, 500);
    }

    function loadContracts(inn) {
      const sel = document.getElementById('contract_select');
      sel.innerHTML = '<option value="">Загрузка договоров...</option>';
      fetch('/get_contracts?inn=' + encodeURIComponent(inn))
        .then(r => r.json())
        .then(data => {
          sel.innerHTML = '<option value="">Не выбран (Создать без привязки)</option>';
          if (data.contracts && data.contracts.length > 0) {
            data.contracts.forEach(cnt => {
              const opt = document.createElement('option');
              opt.value = cnt.id + '|||' + cnt.number + '|||' + cnt.title;
              opt.textContent = '№ ' + cnt.number + ' — ' + cnt.title + ' (' + (cnt.plan_hours || 15) + ' ч/мес)';
              sel.appendChild(opt);
            });
            sel.selectedIndex = 1;
            onContractChange();
          } else {
            sel.innerHTML = '<option value="cnt-auto|||№ б/н|||Договор комплексного сопровождения">№ б/н — Новый договор (Saby не вернул список)</option>';
            onContractChange();
          }
        });
    }

    function onContractChange() {
      const val = document.getElementById('contract_select').value;
      if (!val) {
        document.getElementById('contract_id').value = '';
        document.getElementById('contract_number').value = '';
        document.getElementById('contract_title').value = '';
        return;
      }
      const parts = val.split('|||');
      document.getElementById('contract_id').value = parts[0] || '';
      document.getElementById('contract_number').value = parts[1] || '';
      document.getElementById('contract_title').value = parts[2] || '';
    }

    function addSiteField() {
      const container = document.getElementById('sites-container');
      const div = document.createElement('div');
      div.className = 'dynamic-list-item';
      div.innerHTML = \`
        <input type="text" name="sites[]" class="form-control" placeholder="example.com">
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>
      \`;
      container.appendChild(div);
    }

    function addContactField() {
      const container = document.getElementById('contacts-container');
      const div = document.createElement('div');
      div.className = 'dynamic-list-item';
      div.innerHTML = \`
        <input type="text" name="contact_names[]" class="form-control" placeholder="Имя Фамилия" style="flex: 1;">
        <input type="email" name="contact_emails[]" class="form-control" placeholder="email@company.ru" style="flex: 1;">
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>
      \`;
      container.appendChild(div);
    }
  </script>
</body>
</html>\`;
}
`;

code = code.substring(0, funcStartIndex) + newCode;

fs.writeFileSync('admin_view.js', code);
