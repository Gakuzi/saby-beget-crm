import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { settingsManager } from './settings_manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory sync logs (persisted across restarts in crm_sync_history.json if needed)
let syncHistory = [];

const SYNC_LOG_FILE = path.join(__dirname, '.github_sync_history.json');
try {
  if (fs.existsSync(SYNC_LOG_FILE)) {
    syncHistory = JSON.parse(fs.readFileSync(SYNC_LOG_FILE, 'utf8'));
  }
} catch (e) {
  syncHistory = [];
}

function saveSyncHistory() {
  try {
    fs.writeFileSync(SYNC_LOG_FILE, JSON.stringify(syncHistory.slice(0, 50), null, 2), 'utf8');
  } catch (e) {
    // ignore
  }
}

// Global ensure for git safe.directory to avoid dubious ownership errors on VPS
try {
  execSync('git config --global --add safe.directory "*"', { stdio: 'pipe' });
} catch (e) {
  // ignore
}

// Helper to run git command safely
function runGit(args, cwd = __dirname) {
  try {
    const cmd = `git config --global --add safe.directory "*" 2>/dev/null; git ${args}`;
    const output = execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { ok: true, output: output ? output.trim() : '' };
  } catch (err) {
    return {
      ok: false,
      error: (err.stderr || err.stdout || err.message || '').toString().trim()
    };
  }
}

// Helper to sanitize remote URL to hide tokens
export function sanitizeUrl(url) {
  if (!url) return '';
  return url.replace(/https:\/\/[^@]+@github\.com/i, 'https://***@github.com');
}

export function getGitHubConfig() {
  const raw = settingsManager.getRawSettings();
  const token = (raw.github_token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();
  let repo = (raw.github_repo || process.env.GITHUB_REPO || process.env.GITHUB_REPOSITORY || '').trim();
  
  // Clean repo format if full URL provided
  if (repo.startsWith('http://') || repo.startsWith('https://')) {
    const match = repo.match(/github\.com\/([^\/]+\/[^\/\.]+)/);
    if (match) {
      repo = match[1];
    }
  }

  // Default owner if inferrable
  let owner = (process.env.GITHUB_OWNER || process.env.GITHUB_USER || '').trim();
  if (!owner && repo && repo.includes('/')) {
    owner = repo.split('/')[0];
  }
  if (!owner) {
    owner = 'EKlimov84';
  }

  // Default repo name if empty
  if (!repo) {
    repo = `${owner}/crm-beget-saby`;
  }

  const branch = (raw.github_branch || process.env.GITHUB_BRANCH || 'main').trim();
  const committerName = (process.env.GIT_COMMITTER_NAME || 'Eugene Klimov').trim();
  const committerEmail = (process.env.GIT_COMMITTER_EMAIL || process.env.GITHUB_EMAIL || 'EKlimov84@gmail.com').trim();

  return {
    token,
    hasToken: !!token,
    repo,
    owner,
    branch,
    committerName,
    committerEmail,
    maskedToken: token ? `${token.slice(0, 4)}...${token.slice(-4)}` : null,
    remoteUrl: `https://github.com/${repo}.git`,
    authRemoteUrl: token ? `https://x-access-token:${token}@github.com/${repo}.git` : `https://github.com/${repo}.git`
  };
}

export function initGitRepoIfNeeded() {
  const gitDir = path.join(__dirname, '.git');
  let initialized = fs.existsSync(gitDir);

  if (!initialized) {
    const initRes = runGit('init -b main');
    if (!initRes.ok) {
      // fallback without -b
      runGit('init');
      runGit('checkout -B main');
    }
    initialized = true;
  }

  const cfg = getGitHubConfig();
  runGit(`config user.name "${cfg.committerName}"`);
  runGit(`config user.email "${cfg.committerEmail}"`);

  // Ensure remote origin exists
  const remoteRes = runGit('remote get-url origin');
  if (!remoteRes.ok) {
    runGit(`remote add origin "${cfg.authRemoteUrl}"`);
  } else {
    runGit(`remote set-url origin "${cfg.authRemoteUrl}"`);
  }

  return { initialized };
}

export function getGitStatus() {
  const gitDir = path.join(__dirname, '.git');
  const isInit = fs.existsSync(gitDir);
  const cfg = getGitHubConfig();

  if (!isInit) {
    return {
      isInitialized: false,
      branch: 'main',
      remoteUrl: cfg.remoteUrl,
      hasToken: cfg.hasToken,
      repo: cfg.repo,
      owner: cfg.owner,
      lastCommit: null,
      uncommittedCount: 0,
      uncommittedFiles: [],
      clean: true,
      syncHistory
    };
  }

  // Branch
  let branch = 'main';
  const branchRes = runGit('branch --show-current');
  if (branchRes.ok && branchRes.output) {
    branch = branchRes.output;
  }

  // Last commit
  let lastCommit = null;
  const logRes = runGit('log -1 --format="%H|||%h|||%an|||%ae|||%ad|||%s"');
  if (logRes.ok && logRes.output) {
    const [hash, shortHash, author, email, date, subject] = logRes.output.split('|||');
    lastCommit = { hash, shortHash, author, email, date, subject };
  }

  // Uncommitted changes
  const statusRes = runGit('status --porcelain');
  const uncommittedFiles = [];
  if (statusRes.ok && statusRes.output) {
    statusRes.output.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed) uncommittedFiles.push(trimmed);
    });
  }

  return {
    isInitialized: true,
    branch,
    remoteUrl: cfg.remoteUrl,
    hasToken: cfg.hasToken,
    repo: cfg.repo,
    owner: cfg.owner,
    lastCommit,
    uncommittedCount: uncommittedFiles.length,
    uncommittedFiles,
    clean: uncommittedFiles.length === 0,
    syncHistory
  };
}

export async function testGitHubApi() {
  const cfg = getGitHubConfig();
  if (!cfg.token) {
    return {
      ok: false,
      configured: false,
      message: 'GITHUB_TOKEN не задан в переменных окружения. Укажите его в настройках приложения.'
    };
  }

  try {
    // 1. Verify User Token
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Saby-Beget-CRM-Sync'
      }
    });

    if (!userRes.ok) {
      const errBody = await userRes.text();
      return {
        ok: false,
        configured: true,
        status: userRes.status,
        message: `Ошибка авторизации GitHub API (${userRes.status}): ${errBody}`
      };
    }

    const userData = await userRes.json();

    // 2. Check Repository Access
    let repoData = null;
    let canPush = false;
    const repoRes = await fetch(`https://api.github.com/repos/${cfg.repo}`, {
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Saby-Beget-CRM-Sync'
      }
    });

    if (repoRes.ok) {
      repoData = await repoRes.json();
      canPush = repoData.permissions ? !!repoData.permissions.push : true;
    }

    return {
      ok: true,
      configured: true,
      user: {
        login: userData.login,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url,
        html_url: userData.html_url
      },
      repo: repoData ? {
        full_name: repoData.full_name,
        private: repoData.private,
        default_branch: repoData.default_branch,
        permissions: repoData.permissions,
        html_url: repoData.html_url,
        canPush
      } : null,
      message: `Успешное подключение к GitHub! Пользователь: ${userData.login}. Репозиторий: ${cfg.repo}`
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: `Ошибка сети при обращении к api.github.com: ${err.message}`
    };
  }
}

export function exportDatabaseSnapshot(crmDb) {
  try {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const snapshotPath = path.join(dataDir, 'crm_state_snapshot.json');
    const snapshot = {
      exportedAt: new Date().toISOString(),
      clients: crmDb ? crmDb.clients : [],
      workLogsCount: crmDb ? (crmDb.workLogs || []).length : 0,
      serviceEventsCount: crmDb ? (crmDb.serviceEvents || []).length : 0
    };
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
    return snapshotPath;
  } catch (err) {
    console.warn('Failed to export DB snapshot:', err.message);
    return null;
  }
}

export async function syncToGitHub(options = {}) {
  const { message = 'CRM state and code synchronization', crmDb = null } = options;
  const cfg = getGitHubConfig();

  // Export DB snapshot to repository
  if (crmDb) {
    exportDatabaseSnapshot(crmDb);
  }

  // Initialize git repo
  initGitRepoIfNeeded();

  // Stage changes
  const addRes = runGit('add -A');
  if (!addRes.ok) {
    const logItem = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      status: 'error',
      action: 'git add',
      message: `Ошибка индексации файлов: ${addRes.error}`
    };
    syncHistory.unshift(logItem);
    saveSyncHistory();
    return { ok: false, log: logItem };
  }

  // Check if anything changed
  const statusRes = runGit('status --porcelain');
  let committed = false;
  let commitHash = '';

  if (statusRes.ok && statusRes.output) {
    const commitMsg = `${message} [${new Date().toISOString().slice(0, 19).replace('T', ' ')}]`;
    const commitRes = runGit(`commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    if (!commitRes.ok) {
      const logItem = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        status: 'error',
        action: 'git commit',
        message: `Ошибка создания коммита: ${commitRes.error}`
      };
      syncHistory.unshift(logItem);
      saveSyncHistory();
      return { ok: false, log: logItem };
    }
    committed = true;
  }

  // Get current commit info
  const logRes = runGit('log -1 --format="%h|||%s"');
  if (logRes.ok && logRes.output) {
    commitHash = logRes.output.split('|||')[0];
  }

  // Check if token exists for pushing
  if (!cfg.token) {
    const logItem = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      status: 'warning',
      action: 'local_commit',
      commitHash,
      message: committed
        ? `Локальный коммит ${commitHash} создан. Для отправки на GitHub укажите GITHUB_TOKEN в переменных окружения.`
        : 'Изменений не обнаружено. Локальная ветка актуальна.'
    };
    syncHistory.unshift(logItem);
    saveSyncHistory();
    return { ok: true, pushed: false, log: logItem };
  }

  // Push to GitHub
  // Ensure remote origin has authenticated URL
  runGit(`remote set-url origin "${cfg.authRemoteUrl}"`);

  // Try push to current branch
  const pushRes = runGit(`push -u origin ${cfg.branch}`);
  let pushed = pushRes.ok;
  let pushMessage = '';

  if (!pushRes.ok) {
    // If rejected due to remote having other commits, try push with force-with-lease or fetch
    if (pushRes.error.includes('fetch first') || pushRes.error.includes('non-fast-forward')) {
      runGit(`pull origin ${cfg.branch} --rebase`);
      const retryPush = runGit(`push -u origin ${cfg.branch}`);
      pushed = retryPush.ok;
      pushMessage = pushed ? 'Успешно отправлено после объединения с удаленной веткой' : retryPush.error;
    } else {
      pushMessage = pushRes.error;
    }
  } else {
    pushMessage = pushRes.output || 'Ветка успешно обновлена на GitHub';
  }

  // Clean remote URL in git config so token doesn't linger in plaintext origin url
  runGit(`remote set-url origin "${cfg.remoteUrl}"`);

  const logItem = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    status: pushed ? 'success' : 'error',
    action: 'push',
    commitHash,
    repo: cfg.repo,
    branch: cfg.branch,
    message: pushed
      ? `Коммит ${commitHash} успешно отправлен в GitHub (${cfg.repo}:${cfg.branch})! CI/CD пайплайн запущен.`
      : `Ошибка отправки на GitHub: ${pushMessage}`
  };

  syncHistory.unshift(logItem);
  saveSyncHistory();

  return {
    ok: pushed,
    pushed,
    commitHash,
    log: logItem
  };
}

export async function pullFromGitHub() {
  initGitRepoIfNeeded();
  const cfg = getGitHubConfig();
  const remoteUrl = cfg.authRemoteUrl || cfg.remoteUrl;

  const fetchRes = runGit(`fetch "${remoteUrl}" ${cfg.branch}`);
  if (!fetchRes.ok) {
    const logItem = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      status: 'error',
      action: 'pull',
      message: `Ошибка получения данных с GitHub (${cfg.branch}): ${fetchRes.error}`
    };
    syncHistory.unshift(logItem);
    saveSyncHistory();
    return { ok: false, error: logItem.message, log: logItem };
  }

  const resetRes = runGit(`reset --hard FETCH_HEAD`);
  if (!resetRes.ok) {
    const logItem = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      status: 'error',
      action: 'reset',
      message: `Ошибка применения изменений ветки ${cfg.branch}: ${resetRes.error}`
    };
    syncHistory.unshift(logItem);
    saveSyncHistory();
    return { ok: false, error: logItem.message, log: logItem };
  }

  // Get new commit hash
  const logRes = runGit('log -1 --format="%h|||%s"');
  let commitHash = '';
  if (logRes.ok && logRes.output) {
    commitHash = logRes.output.split('|||')[0];
  }

  const logItem = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    status: 'success',
    action: 'pull',
    commitHash,
    message: `Код и состояние успешно обновлены до последнего коммита ${commitHash} из ветки ${cfg.branch}!`
  };
  syncHistory.unshift(logItem);
  saveSyncHistory();

  return { ok: true, commitHash, log: logItem, message: logItem.message };
}


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
