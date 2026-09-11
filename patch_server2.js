import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

// Update the GET /client/:id endpoint to inject hostingAccounts and sites
code = code.replace(
  /const backups = db.getBackups\(client.id\);/,
  "const backups = db.getBackups(client.id);\n  const hostingAccounts = db.getHostingAccounts ? db.getHostingAccounts(client.id) : [];\n  const clientSites = db.getSites ? db.getSites(client.id) : [];"
);

code = code.replace(
  /credentials: creds,/,
  "credentials: creds,\n    hostingAccounts,\n    clientSites,"
);

fs.writeFileSync('server.js', code);
