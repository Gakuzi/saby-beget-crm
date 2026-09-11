import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const oldAdd = `app.post('/add_client', (req, res) => {
  const { inn, company_name, contract_id, contract_number, contract_title } = req.body;`;

const newAdd = `app.post('/add_client', (req, res) => {
  const { inn, company_name, contract_id, contract_number, contract_title } = req.body;
  const inputInn = inn || req.body.search_input;
  
  if (inputInn) {
    const existing = db.db.prepare('SELECT id FROM clients WHERE inn = ?').get(inputInn);
    if (existing) {
      db.db.prepare('UPDATE clients SET archived = 0 WHERE id = ?').run(existing.id);
      return res.redirect('/client/' + existing.id + '?flash=' + encodeURIComponent('Клиент с таким ИНН уже существует (восстановлен из архива).'));
    }
  }
`;

code = code.replace(oldAdd, newAdd);
fs.writeFileSync('server.js', code);
