import fs from 'fs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.main = "src/server.js";
pkg.scripts.dev = "node src/server.js";
pkg.scripts.start = "node src/server.js";
pkg.scripts.lint = "node --check src/server.js && node --check src/services/github_sync.js && node --check src/services/mailer.js";
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
