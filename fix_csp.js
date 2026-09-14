import fs from 'fs';
let code = fs.readFileSync('src/server.js', 'utf8');

code = code.replace(/app\.use\(\(req, res, next\) => \{\s*res\.setHeader\('Content-Security-Policy'[^}]+\}\);\s*/, '');

fs.writeFileSync('src/server.js', code);
