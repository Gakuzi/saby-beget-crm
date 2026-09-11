import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const anchor = "app.post('/api/client/:id/ssh', async (req, res) => {";
const route = `
app.post('/api/client/:id/test-ssh', async (req, res) => {
  try {
    const clientId = req.params.id;
    // We can use the passed parameters directly instead of DB, to test before saving
    const { host, port, user, pass, key } = req.body || {};
    
    // Just a simple command to check connection
    const credentials = {
      host: host,
      port: parseInt(port) || 22,
      user: user || 'root',
      password: pass && !pass.includes('•••') ? pass : undefined,
      privateKey: key && !key.includes('•••') ? key : undefined
    };

    // If masked, load from DB
    if (!credentials.password && pass && pass.includes('•••')) {
       const clientCreds = db.getClientCredentials(clientId, {mask: false});
       credentials.password = clientCreds.ssh_password;
    }
    if (!credentials.privateKey && key && key.includes('•••')) {
       const clientCreds = db.getClientCredentials(clientId, {mask: false});
       credentials.privateKey = clientCreds.ssh_key;
    }

    const { sshService } = await import('./ssh_service.js');
    const result = await sshService.executeCommand(credentials, 'echo "SSH_OK"', 10000);
    
    if (result.ok) {
      res.json({ ok: true });
    } else {
      res.json({ ok: false, error: result.error || 'Connection failed' });
    }
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});
`;

code = code.replace(anchor, route + '\n' + anchor);
fs.writeFileSync('server.js', code);
