import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const sabyInstructions = `        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 13px; color: #1e40af; line-height: 1.5;">
          <strong>Инструкция: Как получить ключи для интеграции с Saby CRM (СБИС):</strong>
          <ol style="margin-top: 8px; margin-bottom: 0; padding-left: 20px;">
            <li>Войдите в личный кабинет <strong>online.sbis.ru</strong> (с правами администратора).</li>
            <li>Перейдите в раздел <strong>Настройки</strong> (шестеренка) &rarr; <strong>Интеграции</strong> &rarr; <strong>Внешние системы</strong> (или REST API).</li>
            <li>Нажмите <strong>Создать приложение</strong>. Дайте ему название (например, "Интеграция с CRM").</li>
            <li>Скопируйте <strong>Идентификатор приложения (Client ID)</strong> и вставьте в поле ниже.</li>
            <li>Скопируйте <strong>Секретный ключ приложения (App Secret)</strong> и вставьте в поле ниже.</li>
            <li>Если используется <strong>Сервисный ключ (Secret Key)</strong>, сгенерируйте его в разделе интеграций СБИС для пользователя системы и добавьте в поле ниже.</li>
            <li>Сохраните изменения. Указанные ключи будут зашифрованы и сохранены локально на сервере.</li>
          </ol>
        </div>`;

const newSabyInstructions = `        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 13px; color: #1e40af; line-height: 1.5;">
          <strong>Интеграция с Saby CRM (СБИС):</strong>
          <p style="margin-top: 6px; margin-bottom: 0;">Вставьте "ID подключения" и "Защищенный ключ" из настроек вашего приложения в Saby.</p>
        </div>`;

code = code.replace(sabyInstructions, newSabyInstructions);

const sabyInputsOld = `<label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">App Client ID (Идентификатор приложения):</label>
            <input type="text" id="cfg-saby-client-id" placeholder="например: app_12345..." style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">App Secret (Секретный ключ приложения):</label>
            <input type="password" id="cfg-saby-app-secret" placeholder="••••••••••••" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Secret Key (Сервисный ключ пользователя API):</label>
          <input type="password" id="cfg-saby-secret-key" placeholder="••••••••••••" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Используется для методов, требующих токен сессии администратора.</div>
        </div>`;

const sabyInputsNew = `<label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">ID подключения (Client ID):</label>
            <input type="text" id="cfg-saby-client-id" placeholder="Например: 7276372557633339" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Защищенный ключ (App Secret):</label>
            <input type="password" id="cfg-saby-app-secret" placeholder="••••••••••••" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          </div>
        </div>
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">Ключ сервисного доступа (Опционально):</label>
          <input type="password" id="cfg-saby-secret-key" placeholder="Если требуется сервисный доступ (содержимое файла .key)" style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Для некоторых методов API Saby требует передачи содержимого скачанного ключа (secret_key).</div>
        </div>`;

code = code.replace(sabyInputsOld, sabyInputsNew);
fs.writeFileSync('server.js', code);
