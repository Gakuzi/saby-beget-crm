import fs from 'fs';
let code = fs.readFileSync('src/server.js', 'utf8');

code = code.replace(
  '<h2 style="font-weight: 800; font-size: 24px;">CRM-система</h2>',
  '<h2 style="font-weight: 800; font-size: 24px; display: flex; align-items: center; gap: 12px;"><img src="/photo_2026-09-14_14-16-17.jpg" alt="Logo" style="width: 32px; height: 32px; border-radius: 8px; object-fit: cover; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"> CRM-система</h2>'
);

fs.writeFileSync('src/server.js', code);
