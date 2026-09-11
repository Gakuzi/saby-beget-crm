import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  "saby_secret_key: document.getElementById('cfg-saby-secret-key').value\n      };",
  "saby_secret_key: document.getElementById('cfg-saby-secret-key').value === 'HIDDEN' ? '' : document.getElementById('cfg-saby-secret-key').value\n      };"
);

fs.writeFileSync('server.js', code);
