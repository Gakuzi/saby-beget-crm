import fs from 'fs';
let code = fs.readFileSync('src/server.js', 'utf8');
code = code.replace("import('./mailer.js')", "import('./services/mailer.js')");
fs.writeFileSync('src/server.js', code);
