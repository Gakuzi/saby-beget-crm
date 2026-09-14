import fs from 'fs';
let code = fs.readFileSync('src/db/sqlite_db.js', 'utf8');

// I injected inside updateClientFull
// "const client = this.async syncWithSaby(clientId) {"

// Let's remove the corrupted part and re-insert properly
code = code.replace(/updateClientFull\(id, data\) \{[\s\S]*?async syncWithSaby\(clientId\) \{/, 'updateClientFull(id, data) {\n    const client = this.getClientById(id);\n\n  async syncWithSaby(clientId) {');

// Wait, the above would still put syncWithSaby inside updateClientFull!
