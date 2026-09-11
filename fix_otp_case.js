import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /const admin = db\.db\.prepare\('SELECT \* FROM admin_users WHERE email = \?'\)\.get\(email\.trim\(\)\);/g,
  "const admin = db.db.prepare('SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)').get(email.trim());"
);

fs.writeFileSync('server.js', code);
