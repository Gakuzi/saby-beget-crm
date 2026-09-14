import fs from 'fs';
let code = fs.readFileSync('src/db/sqlite_db.js', 'utf8');

const sabyGetters = `
  getSabyDocs(clientId) {
    return this.db.prepare('SELECT * FROM saby_docs WHERE client_id = ? ORDER BY date DESC, id DESC').all(parseInt(clientId, 10));
  }

  getSabyWorks(clientId) {
    return this.db.prepare('SELECT * FROM saby_works WHERE client_id = ? ORDER BY date DESC, id DESC').all(parseInt(clientId, 10));
  }

  getSabyRequests(clientId) {
    return this.db.prepare('SELECT * FROM saby_requests WHERE client_id = ? ORDER BY date DESC, id DESC').all(parseInt(clientId, 10));
  }
`;

code = code.replace(/  getSabyDocs\(clientId\) \{\s*return this\.db\.prepare\('SELECT \* FROM saby_docs WHERE client_id = \? ORDER BY date DESC, id DESC'\)\.all\(parseInt\(clientId, 10\)\);\s*\}/, sabyGetters);
fs.writeFileSync('src/db/sqlite_db.js', code);
