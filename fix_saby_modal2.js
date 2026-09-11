import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const oldModalText = `<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 13px; color: #1e40af; line-height: 1.5;">
          <strong>Интеграция с Saby CRM (СБИС):</strong>
          <p style="margin-top: 6px; margin-bottom: 0;">Вставьте "ID подключения" и "Защищенный ключ" из настроек вашего приложения в Saby.</p>
        </div>`;

const newModalText = `<div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 13px; color: #1e40af; line-height: 1.5;">
          <strong>Интеграция с Saby CRM (СБИС):</strong>
          <ol style="margin-top: 6px; margin-bottom: 0; padding-left: 20px;">
            <li>Вставьте <strong>ID подключения</strong> и <strong>Защищенный ключ</strong> из настроек вашего приложения.</li>
            <li>Откройте скачанный текстовый файл с <strong>сервисным ключом (secret_key)</strong> и скопируйте его содержимое в третье поле. (Это обязательно для работы API).</li>
          </ol>
        </div>`;

code = code.replace(oldModalText, newModalText);

// Make secret key required
code = code.replace(
  'Ключ сервисного доступа (Опционально):',
  'Ключ сервисного доступа (Содержимое файла ключа):'
);

fs.writeFileSync('server.js', code);
