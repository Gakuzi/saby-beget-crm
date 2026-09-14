import fs from 'fs';
let code = fs.readFileSync('src/db/sqlite_db.js', 'utf8');

const target = `  }
  }

  updateClientFull(id, data) {`;
const replace = `  }

  updateClientFull(id, data) {`;
code = code.replace(target, replace);
fs.writeFileSync('src/db/sqlite_db.js', code);
