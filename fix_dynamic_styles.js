import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

code = code.replace(
  "div.className = 'dynamic-list-item';",
  "div.className = 'dynamic-list-item'; div.style.display = 'flex'; div.style.gap = '12px'; div.style.marginBottom = '8px';"
);

fs.writeFileSync('admin_view.js', code);
