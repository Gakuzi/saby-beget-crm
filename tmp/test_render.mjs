import fs from 'fs';
import { db } from './src/db/crm_store.js';

const serverCode = fs.readFileSync('src/server.js', 'utf8');
const startIdx = serverCode.indexOf('res.send(`<!DOCTYPE html>');
const endIdx = serverCode.indexOf('</html>`);', startIdx);
if (startIdx !== -1 && endIdx !== -1) {
  const clients = db.getClients('active');
  const gitStatus = { branch: 'main', uncommittedCount: 0, lastCommit: { shortHash: 'abc', subject: 'test' } };
  const gitConfig = { repo: 'test', remoteUrl: 'test', committerName: 'test', committerEmail: 'test' };
  const filter = 'active';
  const req = { session: { crm_admin_user: 'admin' } };
  
  const tpl = serverCode.substring(startIdx + 9, endIdx + 7);
  const fn = new Function('clients', 'gitStatus', 'gitConfig', 'filter', 'req', 'return ' + tpl);
  const html = fn(clients, gitStatus, gitConfig, filter, req);
  const lines = html.split('\n');
  console.log('Rendered HTML lines:', lines.length);
  for (let i = 875; i <= Math.min(lines.length, 905); i++) {
    console.log(i + ': ' + lines[i - 1]);
  }
} else {
  console.log('Template not found');
}
