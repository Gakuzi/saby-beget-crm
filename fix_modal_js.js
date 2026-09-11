import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const jsStart = "async function openSabySettingsModal() {";
const jsEnd = "async function saveSabyGlobalSettings() {";
const startIndex = code.indexOf(jsStart);
const endIndex = code.indexOf(jsEnd);

if (startIndex !== -1 && endIndex !== -1) {
  const newJS = `async function openSabySettingsModal() {
      const modal = document.getElementById('saby-settings-modal');
      modal.style.display = 'flex';
      const box = document.getElementById('cfg-result-box');
      box.style.display = 'none';
      try {
        const res = await fetch('/api/settings/global');
        const data = await res.json();
        if (data.ok && data.settings) {
          const s = data.settings;
          
          // Saby
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
          passInput.value = '';
          const passStatus = document.getElementById('cfg-smtp-pass-status');
          if (passStatus) {
            if (s.has_smtp_password) {
              passStatus.textContent = '✓ Рабочий пароль сохранен в системе';
              passInput.placeholder = 'Оставьте пустым, если не меняете';
            } else {
              passStatus.textContent = '⚠️ Пароль не установлен';
              passInput.placeholder = 'Введите пароль';
            }
          }
        }
      } catch (err) {
        console.error('Failed to load settings', err);
      }
    }

    async function testBegetFromModal() {
      const btn = document.getElementById('cfg-test-beget-btn');
      const box = document.getElementById('cfg-result-box');
      btn.innerHTML = '⏳ Проверка...';
      btn.disabled = true;
      box.style.display = 'none';

      const payload = {
        beget_login: document.getElementById('cfg-beget-login').value,
        beget_password: document.getElementById('cfg-beget-pass').value
      };

      try {
        const res = await fetch('/api/settings/beget/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        box.style.display = 'block';
        if (data.ok) {
          box.style.background = '#dcfce7';
          box.style.color = '#166534';
          box.style.border = '1px solid #bbf7d0';
          box.innerHTML = '<strong>✅ Успех:</strong> Соединение с Beget API установлено!<br>Аккаунт: ' + (data.account || 'Подключено');
        } else {
          box.style.background = '#fee2e2';
          box.style.color = '#991b1b';
          box.style.border = '1px solid #fecaca';
          box.innerHTML = '<strong>❌ Ошибка Beget:</strong> ' + (data.error || 'Сбой подключения');
        }
      } catch (err) {
        box.style.display = 'block';
        box.style.background = '#fee2e2';
        box.style.color = '#991b1b';
        box.innerHTML = '<strong>❌ Системная ошибка:</strong> ' + err.message;
      } finally {
        btn.innerHTML = '⚡ Проверить связь с Beget';
        btn.disabled = false;
      }
    }

    `;
  code = code.substring(0, startIndex) + newJS + code.substring(endIndex);
  fs.writeFileSync('server.js', code);
  console.log('Fixed JS fetch');
} else {
  console.log('Error: Could not find JS bounds.');
}
