import fs from 'fs';
let code = fs.readFileSync('src/server.js', 'utf8');

// Replace file input with textarea
code = code.replace(
  /<input type="file" id="cfg-saby-file" accept="\.key" style="font-size: 12px; width: 100%; max-width: 300px;">\s*<input type="hidden" id="cfg-saby-secret-key">/,
  '<textarea id="cfg-saby-secret-key" placeholder="Вставьте содержимое файла ключа (.key) сюда..." style="width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-family: monospace; min-height: 80px;"></textarea>'
);

// Remove the saby-file event listener
const listenerRegex = /document\.getElementById\('cfg-saby-file'\)\?\.addEventListener\('change', function\(e\) \{[\s\S]*?\}\);/;
code = code.replace(listenerRegex, '');

fs.writeFileSync('src/server.js', code);
