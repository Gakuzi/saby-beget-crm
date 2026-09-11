import fs from 'fs';
let serverCode = fs.readFileSync('server.js', 'utf8');

const importSync = `import { runGitHubSync, getGitStatus, getGitHubConfig } from './github_sync.js';`;
const newImportSync = `import { runGitHubSync, createGitHubRelease, getGitStatus, getGitHubConfig } from './github_sync.js';`;
serverCode = serverCode.replace(importSync, newImportSync);

const releaseEndpoint = `
app.post('/api/settings/github/release', async (req, res) => {
  if (!req.session.admin_id) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const { version, name, body } = req.body;
  const result = await createGitHubRelease(version, name, body);
  res.json(result);
});
`;

serverCode = serverCode.replace("app.post('/api/settings/github/sync'", releaseEndpoint + "\\napp.post('/api/settings/github/sync'");
fs.writeFileSync('server.js', serverCode);

let syncCode = fs.readFileSync('github_sync.js', 'utf8');
const releaseFunc = `
export async function createGitHubRelease(version, name, body) {
  const config = getGitHubConfig();
  if (!config.token || !config.repo) {
    return { ok: false, error: 'Не настроен GitHub Token или имя репозитория. Заполните их в настройках CRM.' };
  }

  // Push latest changes first
  runGit('add -A');
  runGit('commit -m "chore: Prepare release ' + version + '"');
  runGit('push ' + (config.repoUrl || 'origin') + ' ' + config.branch);

  try {
    const res = await fetch('https://api.github.com/repos/' + config.repo + '/releases', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': 'token ' + config.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tag_name: version,
        name: name,
        body: body,
        draft: false,
        prerelease: false
      })
    });
    const data = await res.json();
    if (res.ok) {
      syncHistory.unshift({ timestamp: new Date().toISOString(), status: 'success', message: 'Создан релиз ' + version });
      saveSyncHistory();
      return { ok: true, url: data.html_url };
    } else {
      return { ok: false, error: data.message || 'Ошибка API GitHub' };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
`;
syncCode += releaseFunc;
fs.writeFileSync('github_sync.js', syncCode);
