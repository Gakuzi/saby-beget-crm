import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  "saby_secret_key: document.getElementById('cfg-saby-secret-key').value === 'HIDDEN' ? '' : document.getElementById('cfg-saby-secret-key').value,",
  "saby_secret_key: document.getElementById('cfg-saby-secret-key').value === 'HIDDEN' ? '' : document.getElementById('cfg-saby-secret-key').value,\n        beget_login: document.getElementById('cfg-beget-login').value,\n        beget_password: document.getElementById('cfg-beget-pass').value,"
);

fs.writeFileSync('server.js', code);
