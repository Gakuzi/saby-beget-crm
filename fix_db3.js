import fs from 'fs';
let code = fs.readFileSync('src/db/sqlite_db.js', 'utf8');

const search = `  updateClientFull(id, data) {
    const client = this.
  async syncWithSaby(clientId) {`;

// We need to restore updateClientFull(id, data) {
// const client = this.getClientById(id);
// AND we need to put async syncWithSaby(clientId) BEFORE updateClientFull or at the end of the class.

// Wait, the rest of syncWithSaby ends with:
// return { ok: true, message: `Синхронизация завершена. Добавлено: ${added}, Обновлено: ${updated}` };
//  }
//  getClientById(id);

let parts = code.split('  updateClientFull(id, data) {\n    const client = this.\n  async syncWithSaby(clientId) {');
if (parts.length === 2) {
  let afterSync = parts[1].split('\n  getClientById(id);');
  if (afterSync.length === 2) {
    let syncFuncBody = afterSync[0];
    let restOfUpdate = afterSync[1];
    
    let newCode = parts[0] + 
      '\n  async syncWithSaby(clientId) {' + syncFuncBody + '\n  }\n\n' +
      '  updateClientFull(id, data) {\n    const client = this.getClientById(id);' + restOfUpdate;
    fs.writeFileSync('src/db/sqlite_db.js', newCode);
    console.log("Fixed successfully");
  } else { console.log("Failed split 2"); }
} else { console.log("Failed split 1"); }
