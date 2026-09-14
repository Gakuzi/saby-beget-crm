import fs from 'fs';
let code = fs.readFileSync('src/db/sqlite_db.js', 'utf8');

const badBlock = `  updateClientFull(id, data) {
    const client = this.
  async syncWithSaby(clientId) {`;

code = code.replace(badBlock, `
  async syncWithSaby(clientId) {`);

// But I need to restore `updateClientFull` ! Let's look at `updateClientFull` before the replacement.
// wait, we can just replace the whole broken part up to the end of syncWithSaby.
