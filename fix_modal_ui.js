import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

// Replace the modal HTML
const modalStart = "<!-- Modal: Saby CRM & Hosting Global Configuration -->";
const modalEnd = "<!-- Action Buttons -->";
const startIndex = code.indexOf(modalStart);
const endIndex = code.indexOf(modalEnd);

if (startIndex !== -1 && endIndex !== -1) {
  const newModalHTML = `<!-- Modal: Saby CRM & Hosting Global Configuration -->
  <div id="saby-settings-modal" class="modal-overlay">
    <div class="modal-card" style="max-width: 750px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
        <h3 style="margin: 0; font-size: 18px; color: #1e1b4b;">⚙️ Глобальные настройки интеграций</h3>
        <button type="button" onclick="closeSabySettingsModal()" style="background: transparent; border: none; font-size: 22px; cursor: pointer; color: #94a3b8;">&times;</button>
      </div>
      
      <!-- Saby API Section -->
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 15px; color: #0f172a;">API СБИС (Saby)</h4>
          <button type="button" id="cfg-test-saby-btn" onclick="testSabyFromModal()" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer;">⚡ Проверить связь с Saby</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">ID подключения (app_client_id):</label>
            <input type="text" id="cfg-saby-client-id" placeholder="Например: 1234abcd-..." style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Секрет приложения (app_secret):</label>
            <input type="password" id="cfg-saby-app-secret" placeholder="Оставьте пустым, если не меняете" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>
        <div>
          <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Защищенный ключ (сертификат .key):</label>
          <div style="display: flex; gap: 10px; align-items: flex-start;">
            <input type="file" id="cfg-saby-file" accept=".key" style="font-size: 12px; width: 100%; max-width: 300px;">
            <input type="hidden" id="cfg-saby-secret-key">
            <div id="cfg-saby-key-status" style="font-size: 11px; margin-top: 4px; color: #64748b;">Здесь будет статус загрузки ключа.</div>
          </div>
        </div>
      </div>

      <!-- Beget API Section -->
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 15px; color: #0f172a;">API Beget (Хостинг)</h4>
          <button type="button" id="cfg-test-beget-btn" onclick="testBegetFromModal()" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer;">⚡ Проверить связь с Beget</button>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; font-size: 12px; color: #1e40af; line-height: 1.5;">
          💡 <strong>Инструкция по API Beget:</strong><br>
          API Beget не использует отдельный "API-ключ". В качестве доступа используется ваш <strong>основной логин</strong> (имя аккаунта, например <code>klimov_beget</code>) и <strong>отдельный пароль для API</strong>.<br>
          Для создания/восстановления пароля API: зайдите в панель управления Beget &rarr; раздел "Настройки" (или "Управление аккаунтом") &rarr; <strong>Пароль для API</strong>. Установите там пароль и впишите его сюда.
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Логин аккаунта Beget:</label>
            <input type="text" id="cfg-beget-login" placeholder="klimov_beget" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Пароль от API Beget:</label>
            <div style="display: flex; gap: 6px;">
              <input type="password" id="cfg-beget-pass" placeholder="Оставьте пустым, если не меняете" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
              <button type="button" onclick="const p=document.getElementById('cfg-beget-pass'); p.type=p.type==='password'?'text':'password';" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:0 8px; border-radius:6px; cursor:pointer;" title="Показать/скрыть">👁️</button>
            </div>
            <div id="cfg-beget-pass-status" style="font-size: 11px; margin-top: 4px; color: #059669; font-weight: 500;"></div>
          </div>
        </div>
      </div>

      <!-- Backup Alerts -->
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
        <h4 style="margin: 0 0 12px 0; font-size: 15px; color: #0f172a;">Бекапы и Алерты</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Webhook Secret для агентов:</label>
            <input type="password" id="cfg-backup-secret" placeholder="Секретный токен для приема бекапов" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Email для срочных алертов:</label>
            <input type="email" id="cfg-backup-email" placeholder="EKlimov84@gmail.com" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>
      </div>

      <!-- SMTP Settings Section -->
      <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 15px; color: #0f172a;">Почта (SMTP) для уведомлений</h4>
          <button type="button" id="cfg-test-smtp-btn" onclick="testSmtpFromModal()" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer;">✉️ Проверить отправку SMTP</button>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; font-size: 12px; color: #1e40af; line-height: 1.5;">
          💡 <strong>Для почты Beget:</strong> Сервер: <code>smtp.beget.com</code>, Порт: <code>465</code>, Шифрование: <code>SSL</code>.<br> Логин и Email отправителя должны совпадать (например <code>noreply@e-klimov.ru</code>).
        </div>
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">SMTP Сервер:</label>
            <input type="text" id="cfg-smtp-host" placeholder="smtp.beget.com" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Порт:</label>
            <input type="number" id="cfg-smtp-port" placeholder="465" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Шифрование:</label>
            <select id="cfg-smtp-secure" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; background: #fff;">
              <option value="true">SSL (Порт 465)</option>
              <option value="false">STARTTLS / Нет</option>
            </select>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Логин / Email ящика:</label>
            <input type="email" id="cfg-smtp-user" autocomplete="off" placeholder="noreply@e-klimov.ru" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Пароль от почтового ящика:</label>
            <div style="display: flex; gap: 6px;">
              <input type="password" id="cfg-smtp-pass" autocomplete="new-password" placeholder="Оставьте пустым, если не меняете" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
              <button type="button" onclick="const p=document.getElementById('cfg-smtp-pass'); p.type=p.type==='password'?'text':'password';" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:0 8px; border-radius:6px; cursor:pointer;" title="Показать/скрыть пароль">👁️</button>
            </div>
            <div id="cfg-smtp-pass-status" style="font-size: 11.5px; margin-top: 3px; color: #059669; font-weight: 500;"></div>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Email отправителя (From):</label>
            <input type="email" id="cfg-smtp-from-email" autocomplete="off" placeholder="noreply@e-klimov.ru" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Имя отправителя:</label>
            <input type="text" id="cfg-smtp-from-name" placeholder="IT-сопровождение | Климов Евгений" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>
      </div>
      
      `;
  code = code.substring(0, startIndex) + newModalHTML + code.substring(endIndex);
  fs.writeFileSync('server.js', code);
  console.log('Fixed modal HTML');
} else {
  console.log('Error: Could not find modal HTML bounds.');
}
