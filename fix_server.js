import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /db\.addWorkLog\(clientId, {[\s\S]*?syncToSaby:.*?\n  }\);/m,
  "db.addWorkLog(clientId, { description, hours, category, dateStr, syncToSaby: sync_to_saby === '1' || sync_to_saby === true });"
);

fs.writeFileSync('server.js', code);
