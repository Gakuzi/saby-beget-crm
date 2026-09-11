import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const warning = `      <div style="background: #fef3c7; color: #92400e; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; text-align: center; border: 1px solid #fcd34d;">
        <b>Возникает цикл авторизации?</b><br>Откройте приложение в новой вкладке (иконка вверху справа) — ваш браузер блокирует cookies в режиме предпросмотра.
      </div>
      <div class="tabs">`;

code = code.replace(/<div class="tabs">/, warning);

fs.writeFileSync('server.js', code);
