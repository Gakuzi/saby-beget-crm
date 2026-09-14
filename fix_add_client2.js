import fs from 'fs';
let code = fs.readFileSync('src/server.js', 'utf8');

const regex = /app\.post\('\/add_client', \(req, res\) => \{ try \{([^]+?)res\.redirect\(`\/client\/\$\{newClient\.id\}`\);\s*\} catch\(err\) \{ console\.error\('ADD_CLIENT_ERROR:', err\); res\.status\(500\)\.send\(err\.message\); \}\n\}\);/s;

code = code.replace(regex, (match, p1) => {
  return `app.post('/add_client', (req, res) => {
  try {
    const { inn, company_name, contract_id, contract_number, contract_title } = req.body;
    const inputInn = inn || req.body.search_input;
    
    if (inputInn) {
      const existing = db.db.prepare('SELECT id FROM clients WHERE inn = ?').get(inputInn);
      if (existing) {
        db.db.prepare('UPDATE clients SET is_archived = 0 WHERE id = ?').run(existing.id);
        return res.redirect('/client/' + existing.id + '?flash=' + encodeURIComponent('Клиент с таким ИНН уже существует (восстановлен из архива).'));
      }
    }
    
    let sitesArray = [];
    if (Array.isArray(req.body['sites[]'])) sitesArray = req.body['sites[]'];
    else if (typeof req.body['sites[]'] === 'string') sitesArray = [req.body['sites[]']];
    else if (Array.isArray(req.body.sites)) sitesArray = req.body.sites;
    else if (typeof req.body.sites === 'string') sitesArray = [req.body.sites];
    const sitesStr = sitesArray.filter(s => s && s.trim() !== '').join(', ');

    let emailsArray = [];
    if (Array.isArray(req.body['contact_emails[]'])) emailsArray = req.body['contact_emails[]'];
    else if (typeof req.body['contact_emails[]'] === 'string') emailsArray = [req.body['contact_emails[]']];
    else if (Array.isArray(req.body.contact_emails)) emailsArray = req.body.contact_emails;
    else if (typeof req.body.contact_emails === 'string') emailsArray = [req.body.contact_emails];
    const emailsStr = emailsArray.filter(e => e && e.trim() !== '').join(', ');

    const newClient = db.addClient({
      inn: inn || req.body.search_input,
      company_name: company_name || req.body.search_input || 'Новый клиент',
      email_reports: emailsStr,
      sites: sitesStr,
      saby_contract_id: contract_id,
      saby_contract_number: contract_number
    });

    let contactNames = [];
    if (Array.isArray(req.body['contact_names[]'])) contactNames = req.body['contact_names[]'];
    else if (typeof req.body['contact_names[]'] === 'string') contactNames = [req.body['contact_names[]']];
    else if (Array.isArray(req.body.contact_names)) contactNames = req.body.contact_names;
    else if (typeof req.body.contact_names === 'string') contactNames = [req.body.contact_names];
    
    for (let i = 0; i < contactNames.length; i++) {
      const cName = (contactNames[i] || '').trim();
      const cEmail = (emailsArray[i] || '').trim();
      if (cName || cEmail) {
        db.addContact(newClient.id, {
          name: cName || 'Представитель',
          position: '',
          email: cEmail,
          phone: '',
          role: 'staff'
        });
      }
    }

    req.session.flash = \`Карточка \${newClient.company_name} успешно создана!\`;
    res.redirect(\`/client/\${newClient.id}\`);
  } catch(err) { 
    console.error('ADD_CLIENT_ERROR:', err); 
    require('fs').appendFileSync('error_log.txt', err.stack + '\\n');
    res.status(500).send(err.message); 
  }
});`;
});

fs.writeFileSync('src/server.js', code);
