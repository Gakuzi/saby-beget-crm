import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const sabyTestRoute = "app.post('/api/settings/saby/test', async (req, res) => {";

const begetTestRoute = `
// Test Beget API from modal
app.post('/api/settings/beget/test', async (req, res) => {
  try {
    const { beget_login, beget_password } = req.body || {};
    
    // Save to settings manager temporarily or permanently to test
    if (beget_login) {
      settingsManager.saveSettings({ beget_login, beget_password });
    }
    
    const { testBegetConnection } = await import('./beget_client.js');
    const testRes = await testBegetConnection();
    
    if (testRes.ok && testRes.answer) {
      // Typically /account/getInfo returns { user_id, plan_id, etc. }
      res.json({ ok: true, account: testRes.answer.plan_name || testRes.answer.user_id || 'Успешно' });
    } else {
      res.json({ ok: false, error: testRes.error });
    }
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});
`;

code = code.replace(sabyTestRoute, begetTestRoute + '\n' + sabyTestRoute);
fs.writeFileSync('server.js', code);
