import fs from 'fs';
let code = fs.readFileSync('sqlite_db.js', 'utf8');

code = code.replace(
  /WHERE username = \? OR email = \?'/,
  "WHERE username = ? OR LOWER(email) = LOWER(?)'"
);

fs.writeFileSync('sqlite_db.js', code);
