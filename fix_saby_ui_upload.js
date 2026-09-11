import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

// Replace the inputs with correct names and add a file uploader for the .key file
const oldInputs = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">App Client ID (Идентификатор приложения):</label>
            <input type="text" id="cfg-saby-client-id" placeholder="например: app_12345..." style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">App Secret (Секретный ключ приложения):</label>
            <input type="password" id="cfg-saby-app-secret" placeholder="••••••••••••" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Secret Key (Сервисный ключ API):</label>
            <input type="password" id="cfg-saby-secret-key" placeholder="••••••••••••" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Адрес RPC сервиса:</label>
            <input type="text" id="cfg-saby-rpc-url" value="https://online.sbis.ru/service/sbis-rpc.service" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Логин пользователя СБИС (опционально):</label>
            <input type="text" id="cfg-saby-login" placeholder="Логин или телефон" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Пароль пользователя СБИС:</label>
            <input type="password" id="cfg-saby-password" placeholder="••••••••••••" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>`;

const newInputs = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">ID подключения (Client ID):</label>
            <input type="text" id="cfg-saby-client-id" placeholder="Например: 7276372557633339" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Защищенный ключ (App Secret):</label>
            <input type="password" id="cfg-saby-app-secret" placeholder="••••••••••••" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Загрузите файл ключа (.key):</label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="file" id="cfg-saby-key-file" accept=".key" style="flex: 1; font-size: 12px; padding: 6px;" onchange="handleKeyFileUpload(event)">
            </div>
            <input type="hidden" id="cfg-saby-secret-key">
            <div id="cfg-saby-key-status" style="font-size: 11px; margin-top: 4px; color: #64748b;">Здесь будет статус загрузки ключа.</div>
          </div>
        </div>`;

code = code.replace(oldInputs, newInputs);

// Add instruction link
const oldInstruction = `<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 13px; color: #1e40af; line-height: 1.5;">
          <strong>Интеграция с Saby CRM (СБИС):</strong>
          <ol style="margin-top: 6px; margin-bottom: 0; padding-left: 20px;">
            <li>Вставьте <strong>ID подключения</strong> и <strong>Защищенный ключ</strong> из настроек вашего приложения.</li>
            <li>Откройте скачанный текстовый файл с <strong>сервисным ключом (secret_key)</strong> и скопируйте его содержимое в третье поле. (Это обязательно для работы API).</li>
          </ol>
        </div>`;

const newInstruction = `<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 13px; color: #1e40af; line-height: 1.5;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>Интеграция с Saby CRM (СБИС):</strong>
            <a href="https://sbis.ru/help/integration/api/auth/service?req=app_client_id" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 500;">📖 Официальная инструкция</a>
          </div>
          <ol style="margin-top: 6px; margin-bottom: 0; padding-left: 20px;">
            <li>Вставьте <strong>ID подключения</strong> и <strong>Защищенный ключ</strong> из настроек внешнего приложения Saby.</li>
            <li>Скачайте сервисный ключ из кабинета СБИС (кнопка ⬇️) и загрузите этот файл <strong>.key</strong> в поле ниже.</li>
          </ol>
        </div>
        
        <script>
        function handleKeyFileUpload(event) {
          const file = event.target.files[0];
          if (!file) return;
          
          const reader = new FileReader();
          reader.onload = function(e) {
            const content = e.target.result;
            document.getElementById('cfg-saby-secret-key').value = content;
            const statusEl = document.getElementById('cfg-saby-key-status');
            statusEl.textContent = '✅ Файл ключа успешно загружен (длина: ' + content.length + ' симв.)';
            statusEl.style.color = '#059669';
          };
          reader.readAsText(file);
        }
        </script>`;

code = code.replace(oldInstruction, newInstruction);

// Also remove `cfg-saby-login`, `cfg-saby-password`, and `cfg-saby-rpc-url` from the JS parsing functions (openSabySettingsModal & saveGlobalConfig)
code = code.replace(
  "document.getElementById('cfg-saby-rpc-url').value = s.saby_rpc_url || 'https://online.sbis.ru/service/sbis-rpc.service';",
  "// removed rpc-url"
);
code = code.replace(
  "document.getElementById('cfg-saby-login').value = s.saby_login || '';",
  "// removed login"
);
code = code.replace(
  "document.getElementById('cfg-saby-password').value = s.has_saby_password ? '••••••••' : '';",
  "// removed pass"
);
code = code.replace(
  "document.getElementById('cfg-saby-secret-key').value = s.has_saby_key ? '••••••••' : '';",
  "document.getElementById('cfg-saby-secret-key').value = s.has_saby_key ? 'HIDDEN' : '';\n          document.getElementById('cfg-saby-key-status').textContent = s.has_saby_key ? '✓ Ключ уже сохранен в CRM (загрузите новый только если нужно обновить)' : '⚠️ Ключ еще не загружен';"
);

code = code.replace(
  "saby_rpc_url: document.getElementById('cfg-saby-rpc-url').value,",
  "// saby_rpc_url: removed,"
);
code = code.replace(
  "saby_login: document.getElementById('cfg-saby-login').value,",
  "// saby_login: removed,"
);
code = code.replace(
  "saby_password: document.getElementById('cfg-saby-password').value,",
  "// saby_password: removed,"
);

// We need to filter out 'HIDDEN' from secret key when saving
code = code.replace(
  "saby_secret_key: document.getElementById('cfg-saby-secret-key').value,",
  "saby_secret_key: document.getElementById('cfg-saby-secret-key').value === 'HIDDEN' ? '' : document.getElementById('cfg-saby-secret-key').value,"
);

fs.writeFileSync('server.js', code);
