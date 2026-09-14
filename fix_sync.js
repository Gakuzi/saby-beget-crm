import fs from 'fs';
let code = fs.readFileSync('src/db/sqlite_db.js', 'utf8');

const syncFunction = `
  async syncWithSaby(clientId) {
    const client = this.getClientById(clientId);
    if (!client || !client.inn) throw new Error('Клиент или ИНН не найден');
    
    // Dynamically import to avoid circular dependency
    const { fetchSabyContracts } = await import('../services/saby_client.js');
    const result = await fetchSabyContracts(client.inn);
    
    if (!result.ok) {
      throw new Error(result.error || 'Ошибка при синхронизации с Saby');
    }
    
    // Save to database
    let added = 0;
    let updated = 0;
    
    for (const doc of result.contracts) {
      const existing = this.db.prepare('SELECT id FROM saby_docs WHERE client_id = ? AND saby_id = ?').get(clientId, doc.id);
      if (existing) {
        this.db.prepare('UPDATE saby_docs SET type = ?, number = ?, date = ?, status = ? WHERE id = ?')
          .run('Договор', doc.number, doc.date, doc.status, existing.id);
        updated++;
      } else {
        this.db.prepare('INSERT INTO saby_docs (client_id, saby_id, type, number, date, status, sum) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(clientId, doc.id, 'Договор', doc.number, doc.date, doc.status, parseFloat(doc.sum || 0));
        added++;
      }
    }
    
    // Create a sync log if table exists, or just return
    return { ok: true, message: \`Синхронизация завершена. Добавлено: \${added}, Обновлено: \${updated}\` };
  }
`;

code = code.replace(/getClientById\(id\)/, syncFunction + '\n  getClientById(id)');
fs.writeFileSync('src/db/sqlite_db.js', code);
