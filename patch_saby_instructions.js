import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const instructions = `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; font-size: 13px; color: #1e40af; line-height: 1.5;">
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
        </div>
`;

code = code.replace(
  /<!-- Saby API Credentials Group -->\s*<div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 16px;">\s*<h4 style="margin: 0 0 12px; font-size: 14.5px; color: #0369a1; display: flex; align-items: center; gap: 6px;">\s*<span>🏢<\/span> Интеграция с Saby CRM \/ СБИС \(online.sbis.ru\)\s*<\/h4>/,
  `<!-- Saby API Credentials Group -->
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
        <h4 style="margin: 0 0 12px; font-size: 14.5px; color: #0369a1; display: flex; align-items: center; gap: 6px;">
          <span>🏢</span> Интеграция с Saby CRM / СБИС (online.sbis.ru)
        </h4>
${instructions}`
);

fs.writeFileSync('server.js', code);
