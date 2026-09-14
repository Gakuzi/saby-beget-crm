import fs from 'fs';
let code = fs.readFileSync('src/db/sqlite_db.js', 'utf8');
code = code.replace(/  \}\n  \}\n\n  updateClientFull/g, '  }\n\n  updateClientFull');
fs.writeFileSync('src/db/sqlite_db.js', code);
