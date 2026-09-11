import fs from 'fs';

let code = fs.readFileSync('src/server.js', 'utf8');

// Replace standard document.getElementById(X).value = Y with a safe helper
const helperCode = `
    function safeSetVal(id, val) {
      const el = document.getElementById(id);
      if (el) el.value = val;
    }
    function safeSetText(id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }
    function safeGetVal(id) {
      const el = document.getElementById(id);
      return el ? el.value : '';
    }
`;

// Wait, the easiest way to make openSabySettingsModal safe is a regex replace.
// Let's just manually replace the entire block.
const oldBlock = `          // Saby
          document.getElementById('cfg-saby-client-id').value = s.saby_app_client_id || '';
          document.getElementById('cfg-saby-app-secret').value = s.has_saby_secret ? '••••••••' : '';
          document.getElementById('cfg-saby-secret-key').value = s.has_saby_key ? 'HIDDEN' : '';
          document.getElementById('cfg-saby-key-status').textContent = s.has_saby_key ? '✓ Ключ сохранен' : '⚠️ Ключ не загружен';
          
          // Beget
          document.getElementById('cfg-beget-login').value = s.beget_login || '';
          document.getElementById('cfg-beget-pass').value = ''; // clean for placeholder
          const begetPassStatus = document.getElementById('cfg-beget-pass-status');
          if (begetPassStatus) {
            if (s.has_beget_password) {
              begetPassStatus.textContent = '✓ Пароль сохранен в системе';
              document.getElementById('cfg-beget-pass').placeholder = 'Оставьте пустым, если не меняете';
            } else {
              begetPassStatus.textContent = '⚠️ Пароль не установлен';
              document.getElementById('cfg-beget-pass').placeholder = 'Введите пароль от API';
            }
          }

          // Backups
          document.getElementById('cfg-backup-secret').value = s.backup_webhook_secret || '';
          document.getElementById('cfg-backup-email').value = s.backup_alert_email || '';
          
          // SMTP (Removed defaults so it doesn't show fake info)
          document.getElementById('cfg-smtp-host').value = s.smtp_host || '';
          document.getElementById('cfg-smtp-port').value = s.smtp_port || '';
          document.getElementById('cfg-smtp-user').value = s.smtp_user || '';
          document.getElementById('cfg-smtp-from-email').value = s.smtp_from_email || '';
          document.getElementById('cfg-smtp-from-name').value = s.smtp_from_name || '';
          document.getElementById('cfg-admin-notify-email').value = s.admin_notify_email || '';
          
          // Clear password input to prevent browser autofill overwriting the real mailbox password
          const passInput = document.getElementById('cfg-smtp-pass');
          passInput.value = '';`;

const newBlock = `          const safeSet = (id, val) => { const e = document.getElementById(id); if (e) e.value = val; };
          const safeText = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
          
          // Saby
          safeSet('cfg-saby-client-id', s.saby_app_client_id || '');
          safeSet('cfg-saby-app-secret', s.has_saby_secret ? '••••••••' : '');
          safeSet('cfg-saby-secret-key', s.has_saby_key ? 'HIDDEN' : '');
          safeText('cfg-saby-key-status', s.has_saby_key ? '✓ Ключ сохранен' : '⚠️ Ключ не загружен');
          
          // Beget
          safeSet('cfg-beget-login', s.beget_login || '');
          safeSet('cfg-beget-pass', ''); // clean for placeholder
          const begetPassStatus = document.getElementById('cfg-beget-pass-status');
          if (begetPassStatus) {
            if (s.has_beget_password) {
              begetPassStatus.textContent = '✓ Пароль сохранен в системе';
              const bp = document.getElementById('cfg-beget-pass');
              if (bp) bp.placeholder = 'Оставьте пустым, если не меняете';
            } else {
              begetPassStatus.textContent = '⚠️ Пароль не установлен';
              const bp = document.getElementById('cfg-beget-pass');
              if (bp) bp.placeholder = 'Введите пароль от API';
            }
          }

          // Backups
          safeSet('cfg-backup-secret', s.backup_webhook_secret || '');
          safeSet('cfg-backup-email', s.backup_alert_email || '');
          
          // SMTP
          safeSet('cfg-smtp-host', s.smtp_host || '');
          safeSet('cfg-smtp-port', s.smtp_port || '');
          safeSet('cfg-smtp-user', s.smtp_user || '');
          safeSet('cfg-smtp-from-email', s.smtp_from_email || '');
          safeSet('cfg-smtp-from-name', s.smtp_from_name || '');
          safeSet('cfg-admin-notify-email', s.admin_notify_email || '');
          
          // Clear password
          safeSet('cfg-smtp-pass', '');`;

code = code.replace(oldBlock, newBlock);

const oldSaveBlock = `      const payload = {
        saby_app_client_id: document.getElementById('cfg-saby-client-id').value,
        saby_app_secret: document.getElementById('cfg-saby-app-secret').value,
        saby_secret_key: document.getElementById('cfg-saby-secret-key').value === 'HIDDEN' ? '' : document.getElementById('cfg-saby-secret-key').value,
        beget_login: document.getElementById('cfg-beget-login').value,
        beget_password: document.getElementById('cfg-beget-pass').value,
        // saby_rpc_url: removed,
        // saby_login: removed,
        // saby_password: removed,
        backup_webhook_secret: document.getElementById('cfg-backup-secret').value,
        backup_alert_email: document.getElementById('cfg-backup-email').value,
        smtp_host: document.getElementById('cfg-smtp-host').value,
        smtp_port: document.getElementById('cfg-smtp-port').value,
        smtp_secure: document.getElementById('cfg-smtp-secure').value === 'true',
        smtp_user: document.getElementById('cfg-smtp-user').value,
        smtp_password: document.getElementById('cfg-smtp-pass').value,
        smtp_from_email: document.getElementById('cfg-smtp-from-email').value || document.getElementById('cfg-smtp-user').value,
        smtp_from_name: document.getElementById('cfg-smtp-from-name').value,
        admin_notify_email: document.getElementById('cfg-admin-notify-email').value
      };`;

const newSaveBlock = `      const safeGet = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
      const secretKeyVal = safeGet('cfg-saby-secret-key');
      const payload = {
        saby_app_client_id: safeGet('cfg-saby-client-id'),
        saby_app_secret: safeGet('cfg-saby-app-secret'),
        saby_secret_key: secretKeyVal === 'HIDDEN' ? '' : secretKeyVal,
        beget_login: safeGet('cfg-beget-login'),
        beget_password: safeGet('cfg-beget-pass'),
        backup_webhook_secret: safeGet('cfg-backup-secret'),
        backup_alert_email: safeGet('cfg-backup-email'),
        smtp_host: safeGet('cfg-smtp-host'),
        smtp_port: safeGet('cfg-smtp-port'),
        smtp_secure: safeGet('cfg-smtp-secure') === 'true',
        smtp_user: safeGet('cfg-smtp-user'),
        smtp_password: safeGet('cfg-smtp-pass'),
        smtp_from_email: safeGet('cfg-smtp-from-email') || safeGet('cfg-smtp-user'),
        smtp_from_name: safeGet('cfg-smtp-from-name'),
        admin_notify_email: safeGet('cfg-admin-notify-email')
      };`;

code = code.replace(oldSaveBlock, newSaveBlock);

// Replace any remaining .value that could crash other save functions if any, e.g. test smtp
const oldSmtpTest = `        smtp_host: document.getElementById('cfg-smtp-host').value,
        smtp_port: document.getElementById('cfg-smtp-port').value,
        smtp_secure: document.getElementById('cfg-smtp-secure').value === 'true',
        smtp_user: document.getElementById('cfg-smtp-user').value,
        smtp_password: document.getElementById('cfg-smtp-pass').value,
        smtp_from_email: document.getElementById('cfg-smtp-from-email')?.value || document.getElementById('cfg-smtp-user').value,
        smtp_from_name: document.getElementById('cfg-smtp-from-name').value`;
const newSmtpTest = `        smtp_host: safeGet('cfg-smtp-host'),
        smtp_port: safeGet('cfg-smtp-port'),
        smtp_secure: safeGet('cfg-smtp-secure') === 'true',
        smtp_user: safeGet('cfg-smtp-user'),
        smtp_password: safeGet('cfg-smtp-pass'),
        smtp_from_email: safeGet('cfg-smtp-from-email') || safeGet('cfg-smtp-user'),
        smtp_from_name: safeGet('cfg-smtp-from-name')`;
code = code.replace(oldSmtpTest, newSmtpTest);

// Replace testBegetFromModal
const oldBegetTest = `        beget_login: document.getElementById('cfg-beget-login').value,
        beget_password: document.getElementById('cfg-beget-pass').value`;
const newBegetTest = `        beget_login: safeGet('cfg-beget-login'),
        beget_password: safeGet('cfg-beget-pass')`;
code = code.replace(oldBegetTest, newBegetTest);

// Replace testSabyFromModal
const oldSabyTest = `        saby_app_client_id: document.getElementById('cfg-saby-client-id').value,
        saby_app_secret: document.getElementById('cfg-saby-app-secret').value,
        saby_secret_key: document.getElementById('cfg-saby-secret-key').value === 'HIDDEN' ? '' : document.getElementById('cfg-saby-secret-key').value`;
const newSabyTest = `        saby_app_client_id: safeGet('cfg-saby-client-id'),
        saby_app_secret: safeGet('cfg-saby-app-secret'),
        saby_secret_key: safeGet('cfg-saby-secret-key') === 'HIDDEN' ? '' : safeGet('cfg-saby-secret-key')`;
code = code.replace(oldSabyTest, newSabyTest);

// Make sure safeGet is defined in the global script block if it's used across multiple functions.
// Let's just define it at the top of the script block.
const scriptStart = `<script>
    function switchTab(t) {`;
const safeHelpers = `<script>
    const safeGet = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
    function switchTab(t) {`;
code = code.replace(scriptStart, safeHelpers);

fs.writeFileSync('src/server.js', code);
