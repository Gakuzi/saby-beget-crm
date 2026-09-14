import fs from 'fs';
let code = fs.readFileSync('src/db/sqlite_db.js', 'utf8');

const tables = `
      CREATE TABLE IF NOT EXISTS saby_works (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        saby_id TEXT,
        document_number TEXT,
        date TEXT,
        work_name TEXT,
        quantity REAL,
        unit TEXT,
        price REAL,
        sum REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS saby_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        saby_id TEXT,
        number TEXT,
        date TEXT,
        subject TEXT,
        status TEXT,
        executor TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
`;

code = code.replace(/CREATE TABLE IF NOT EXISTS saby_docs \([\s\S]*?\);/, 'CREATE TABLE IF NOT EXISTS saby_docs ( id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER, saby_id TEXT, type TEXT, number TEXT, date TEXT, sum REAL, status TEXT, url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP );' + tables);

const oldSync = `  async syncWithSaby(clientId) {
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
  }`;

const newSync = `  async syncWithSaby(clientId) {
    const client = this.getClientById(clientId);
    if (!client || !client.inn) throw new Error('Клиент или ИНН не найден');
    
    const { fetchSabyContracts, fetchSabyRequests, fetchSabyWorks } = await import('../services/saby_client.js');
    
    let added = 0, updated = 0;
    
    const resContracts = await fetchSabyContracts(client.inn);
    if (resContracts.ok && resContracts.contracts) {
      for (const doc of resContracts.contracts) {
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
    }
    
    const resReqs = await fetchSabyRequests(client.inn);
    if (resReqs.ok && resReqs.requests) {
      for (const req of resReqs.requests) {
        const existing = this.db.prepare('SELECT id FROM saby_requests WHERE client_id = ? AND saby_id = ?').get(clientId, req.id);
        if (existing) {
          this.db.prepare('UPDATE saby_requests SET number = ?, date = ?, subject = ?, status = ?, executor = ? WHERE id = ?')
            .run(req.number, req.date, req.subject, req.status, req.executor, existing.id);
          updated++;
        } else {
          this.db.prepare('INSERT INTO saby_requests (client_id, saby_id, number, date, subject, status, executor) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(clientId, req.id, req.number, req.date, req.subject, req.status, req.executor);
          added++;
        }
      }
    }
    
    const resWorks = await fetchSabyWorks(client.inn);
    if (resWorks.ok && resWorks.works) {
      for (const w of resWorks.works) {
        const existing = this.db.prepare('SELECT id FROM saby_works WHERE client_id = ? AND saby_id = ?').get(clientId, w.id);
        if (existing) {
          this.db.prepare('UPDATE saby_works SET document_number = ?, date = ?, work_name = ?, quantity = ?, unit = ?, price = ?, sum = ? WHERE id = ?')
            .run(w.document_number, w.date, w.work_name, w.quantity, w.unit, w.price, w.sum, existing.id);
          updated++;
        } else {
          this.db.prepare('INSERT INTO saby_works (client_id, saby_id, document_number, date, work_name, quantity, unit, price, sum) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(clientId, w.id, w.document_number, w.date, w.work_name, w.quantity, w.unit, w.price, w.sum);
          added++;
        }
      }
    }
    
    return { ok: true, message: \`Синхронизация завершена. Добавлено: \${added}, Обновлено: \${updated}\` };
  }`;

code = code.replace(oldSync, newSync);
fs.writeFileSync('src/db/sqlite_db.js', code);
