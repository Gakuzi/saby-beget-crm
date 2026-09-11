import { Client } from 'ssh2';

class SSHService {
  /**
   * Run a single command or script remotely on client VPS via SSH2
   */
  async executeCommand(credentials, command, timeoutMs = 25000) {
    const { host, port = 22, user = 'root', password, privateKey } = credentials;

    if (!host) {
      return { ok: false, error: 'Не указан хост (IP или FQDN) сервера для подключения по SSH' };
    }

    return new Promise((resolve) => {
      const conn = new Client();
      let stdout = '';
      let stderr = '';
      let isResolved = false;

      const timer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          try { conn.end(); } catch (e) {}
          resolve({ ok: false, error: `Таймаут выполнения команды (${timeoutMs / 1000}с)` });
        }
      }, timeoutMs);

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            if (!isResolved) {
              isResolved = true;
              return resolve({ ok: false, error: 'Ошибка выполнения команды: ' + err.message });
            }
          }

          stream.on('close', (code, signal) => {
            clearTimeout(timer);
            conn.end();
            if (!isResolved) {
              isResolved = true;
              resolve({
                ok: code === 0,
                exitCode: code,
                signal,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                output: (stdout + (stderr ? '\n[STDERR]\n' + stderr : '')).trim()
              });
            }
          });

          stream.on('data', (data) => {
            stdout += data.toString('utf8');
          });

          stream.stderr.on('data', (data) => {
            stderr += data.toString('utf8');
          });
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timer);
        if (!isResolved) {
          isResolved = true;
          let userMsg = err.message;
          if (err.level === 'client-authentication') {
            userMsg = 'Ошибка аутентификации SSH: неверный пароль или приватный ключ пользователя ' + user;
          } else if (err.code === 'ECONNREFUSED') {
            userMsg = `Порт ${port} на хосте ${host} недоступен (Connection refused). Проверьте порт и настройки брандмауэра.`;
          } else if (err.code === 'ETIMEDOUT') {
            userMsg = `Сервер ${host}:${port} не отвечает (Connection timed out). Проверьте IP-адрес.`;
          }
          resolve({ ok: false, error: userMsg, rawError: err.message });
        }
      });

      try {
        const connectOpts = {
          host: String(host).trim(),
          port: parseInt(port, 10) || 22,
          username: String(user).trim() || 'root',
          readyTimeout: 12000
        };

        if (privateKey && typeof privateKey === 'string' && privateKey.trim().includes('PRIVATE KEY')) {
          connectOpts.privateKey = privateKey.trim();
        } else if (password) {
          connectOpts.password = String(password).trim();
        } else {
          return resolve({ ok: false, error: 'Не указан ни пароль, ни SSH приватный ключ для пользователя ' + user });
        }

        conn.connect(connectOpts);
      } catch (ex) {
        clearTimeout(timer);
        resolve({ ok: false, error: 'Ошибка инициализации подключения: ' + ex.message });
      }
    });
  }

  /**
   * Test SSH connectivity with server
   */
  async testConnection(credentials) {
    const res = await this.executeCommand(credentials, 'uname -a && uptime', 10000);
    if (res.ok) {
      return {
        ok: true,
        message: 'Соединение по SSH успешно установлено! Сервер: ' + (res.stdout.split('\n')[0] || 'Linux')
      };
    }
    return { ok: false, error: res.error || res.stderr || 'Не удалось подключиться к серверу' };
  }

  /**
   * Automatically deploy crm_backup_agent.php to remote server and register cron job
   */
  async installBackupAgent(credentials, { agentCode, targetDir = '/home/bitrix/www', cronTime = '15 4 * * *' }) {
    // 1. Ensure target directory exists
    const safeDir = targetDir.replace(/'/g, "'\\''");
    const scriptPath = `${safeDir}/crm_backup_agent.php`;

    // Encode PHP script into base64 to avoid quote escaping issues over SSH
    const b64 = Buffer.from(agentCode, 'utf8').toString('base64');

    const installCmd = `
mkdir -p '${safeDir}' && \
echo '${b64}' | base64 -d > '${scriptPath}' && \
chmod 644 '${scriptPath}' && \
php -l '${scriptPath}' && \
(crontab -l 2>/dev/null | grep -v 'crm_backup_agent.php' ; echo "${cronTime} /usr/bin/php -f ${scriptPath} >/dev/null 2>&1") | crontab - && \
echo "SUCCESS_INSTALLED"
`.trim();

    const res = await this.executeCommand(credentials, installCmd, 20000);
    if (res.ok && res.stdout.includes('SUCCESS_INSTALLED')) {
      return {
        ok: true,
        scriptPath,
        message: `Агент бэкапов успешно загружен в ${scriptPath} и добавлен в crontab (${cronTime})!`
      };
    }

    return {
      ok: false,
      error: res.error || res.stderr || res.stdout || 'Не удалось завершить установку агента через SSH'
    };
  }
}

export const sshService = new SSHService();
