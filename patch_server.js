import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

// Add endpoints
const newEndpoints = `
// --- Hosting Accounts & Sites API ---
app.post('/api/client/:id/hosting', (req, res) => {
  try {
    const id = db.addHostingAccount(req.params.id, req.body);
    res.json({ ok: true, id });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/client/:id/hosting/:host_id/delete', (req, res) => {
  try {
    db.deleteHostingAccount(req.params.host_id);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/client/:id/sites', (req, res) => {
  try {
    const id = db.addSite(req.params.id, req.body);
    res.json({ ok: true, id });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/client/:id/sites/:site_id/delete', (req, res) => {
  try {
    db.deleteSite(req.params.site_id);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/system/reset', (req, res) => {
  try {
    db.resetDatabase();
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/system/seed_test', (req, res) => {
  try {
    const clientId = db.addClient({
      inn: '7736207543',
      company_name: 'ООО "Яндекс" (Тестовый клиент)',
      email_reports: 'reports@yandex.ru',
      sites: 'yandex.ru',
      saby_contract_id: 'test-doc-123',
      saby_contract_number: '№ 123-ТЕСТ',
      monthly_fee: 150000,
      contract_start_date: new Date().toISOString().slice(0, 10)
    });
    
    const hostId = db.addHostingAccount(clientId, {
      provider_name: 'Yandex Cloud',
      provider_url: 'https://console.cloud.yandex.ru',
      login: 'admin@yandex.ru',
      password: 'super-secure-password',
      api_key: 'AQVN-TestApiKey123',
      notes: 'Тестовый хостинг'
    });
    
    db.addSite(clientId, {
      hosting_account_id: hostId,
      url: 'yandex.ru',
      cms_type: 'Custom React',
      cms_login: 'admin',
      cms_password: 'cms-password',
      ssh_host: '8.8.8.8',
      ssh_user: 'root',
      ssh_password: 'ssh-password'
    });
    
    db.addSite(clientId, {
      hosting_account_id: hostId,
      url: 'market.yandex.ru',
      cms_type: '1C-Bitrix',
      cms_login: 'admin',
      cms_password: 'market-password',
      ssh_host: '8.8.8.9',
      ssh_user: 'root',
      ssh_password: 'ssh-password-2'
    });
    
    res.json({ ok: true, clientId });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
`;

code = code.replace(/app\.post\('\/api\/client\/:id\/archive'/s, match => newEndpoints + '\n' + match);
fs.writeFileSync('server.js', code);
