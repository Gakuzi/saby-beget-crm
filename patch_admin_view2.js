import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

const modalHtml = `
  <!-- Modal: Add Hosting -->
  <div id="add-hosting-modal" class="modal-overlay">
    <div class="modal-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
        <h3 style="margin: 0; font-size: 18px; color: #1e1b4b; display: flex; align-items: center; gap: 8px;">
          <span>☁️</span> Добавить хостинг
        </h3>
        <button type="button" onclick="closeAddHostingModal()" style="background: transparent; border: none; font-size: 22px; cursor: pointer; color: #94a3b8;">&times;</button>
      </div>
      <form id="add-hosting-form">
        <div class="form-group">
          <label>Провайдер (напр. Beget, Timeweb):</label>
          <input type="text" id="host_provider_name" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Ссылка на панель управления:</label>
          <input type="text" id="host_provider_url" class="form-control" placeholder="https://cp.beget.com">
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
          <div class="form-group">
            <label>Логин:</label>
            <input type="text" id="host_login" class="form-control">
          </div>
          <div class="form-group">
            <label>Пароль:</label>
            <input type="text" id="host_password" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label>API-ключ:</label>
          <input type="text" id="host_api_key" class="form-control">
        </div>
        <div style="text-align: right; margin-top: 20px;">
          <button type="button" onclick="closeAddHostingModal()" class="btn" style="background: #e2e8f0; color: #475569; margin-right: 8px;">Отмена</button>
          <button type="button" onclick="submitAddHosting(\${client.id})" class="btn" style="background: #10b981; color: #fff;">Добавить</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal: Add Site -->
  <div id="add-site-modal" class="modal-overlay">
    <div class="modal-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
        <h3 style="margin: 0; font-size: 18px; color: #1e1b4b; display: flex; align-items: center; gap: 8px;">
          <span>🌐</span> Добавить сайт
        </h3>
        <button type="button" onclick="closeAddSiteModal()" style="background: transparent; border: none; font-size: 22px; cursor: pointer; color: #94a3b8;">&times;</button>
      </div>
      <form id="add-site-form">
        <input type="hidden" id="site_hosting_id">
        <div class="form-group">
          <label>URL сайта (домен):</label>
          <input type="text" id="site_url" class="form-control" placeholder="example.com" required>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
          <div class="form-group">
            <label>Тип CMS:</label>
            <input type="text" id="site_cms_type" class="form-control" value="1C-Bitrix">
          </div>
          <div class="form-group"></div>
          <div class="form-group">
            <label>Логин CMS:</label>
            <input type="text" id="site_cms_login" class="form-control" value="admin">
          </div>
          <div class="form-group">
            <label>Пароль CMS:</label>
            <input type="text" id="site_cms_password" class="form-control">
          </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:16px; margin-top:16px;">
          <div class="form-group">
            <label>SSH Хост:</label>
            <input type="text" id="site_ssh_host" class="form-control">
          </div>
          <div class="form-group">
            <label>SSH Пользователь:</label>
            <input type="text" id="site_ssh_user" class="form-control">
          </div>
          <div class="form-group">
            <label>SSH Пароль:</label>
            <input type="text" id="site_ssh_password" class="form-control">
          </div>
        </div>
        <div style="text-align: right; margin-top: 20px;">
          <button type="button" onclick="closeAddSiteModal()" class="btn" style="background: #e2e8f0; color: #475569; margin-right: 8px;">Отмена</button>
          <button type="button" onclick="submitAddSite(\${client.id})" class="btn" style="background: #10b981; color: #fff;">Добавить</button>
        </div>
      </form>
    </div>
  </div>
`;

code = code.replace(/<!-- Modal: Edit Work Log -->/, modalHtml + '\n  <!-- Modal: Edit Work Log -->');

const jsFuncs = `
    function openAddHostingModal() { document.getElementById('add-hosting-modal').style.display = 'flex'; }
    function closeAddHostingModal() { document.getElementById('add-hosting-modal').style.display = 'none'; }
    function submitAddHosting(clientId) {
      fetch('/api/client/' + clientId + '/hosting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_name: document.getElementById('host_provider_name').value,
          provider_url: document.getElementById('host_provider_url').value,
          login: document.getElementById('host_login').value,
          password: document.getElementById('host_password').value,
          api_key: document.getElementById('host_api_key').value
        })
      }).then(r=>r.json()).then(res => { if(res.ok) window.location.reload(); else alert(res.error); });
    }
    function deleteHosting(hostId) {
      if(!confirm('Удалить этот хостинг и все связанные с ним сайты?')) return;
      fetch('/api/client/0/hosting/' + hostId + '/delete', { method: 'POST' })
        .then(r=>r.json()).then(res => { if(res.ok) window.location.reload(); });
    }
    
    function openAddSiteModal(hostId) { 
      document.getElementById('site_hosting_id').value = hostId || '';
      document.getElementById('add-site-modal').style.display = 'flex'; 
    }
    function closeAddSiteModal() { document.getElementById('add-site-modal').style.display = 'none'; }
    function submitAddSite(clientId) {
      fetch('/api/client/' + clientId + '/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hosting_account_id: document.getElementById('site_hosting_id').value,
          url: document.getElementById('site_url').value,
          cms_type: document.getElementById('site_cms_type').value,
          cms_login: document.getElementById('site_cms_login').value,
          cms_password: document.getElementById('site_cms_password').value,
          ssh_host: document.getElementById('site_ssh_host').value,
          ssh_user: document.getElementById('site_ssh_user').value,
          ssh_password: document.getElementById('site_ssh_password').value
        })
      }).then(r=>r.json()).then(res => { if(res.ok) window.location.reload(); else alert(res.error); });
    }
    function deleteSite(siteId) {
      if(!confirm('Удалить этот сайт?')) return;
      fetch('/api/client/0/sites/' + siteId + '/delete', { method: 'POST' })
        .then(r=>r.json()).then(res => { if(res.ok) window.location.reload(); });
    }
`;

code = code.replace(/function openEditLogModal/, jsFuncs + '\n    function openEditLogModal');

fs.writeFileSync('admin_view.js', code);
