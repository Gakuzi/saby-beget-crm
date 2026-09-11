import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const oldAddClient = `// Add client POST
app.post('/add_client', (req, res) => {
  const { inn, company_name, emails, sites, contract_id, contract_number } = req.body;
  const newClient = db.addClient({
    inn: inn || req.body.search_input,
    company_name: company_name || req.body.search_input,
    email_reports: emails,
    sites,
    saby_contract_id: contract_id,
    saby_contract_number: contract_number
  });
  req.session.flash = \`Карточка контрагента \${newClient.company_name} успешно создана!\`;
  res.redirect(\`/client/\${newClient.id}\`);
});`;

const newAddClient = `// Add client POST
app.post('/add_client', (req, res) => {
  const { inn, company_name, contract_id, contract_number, contract_title } = req.body;
  
  // Parse sites
  let sitesArray = [];
  if (Array.isArray(req.body['sites[]'])) sitesArray = req.body['sites[]'];
  else if (typeof req.body['sites[]'] === 'string') sitesArray = [req.body['sites[]']];
  const sitesStr = sitesArray.filter(s => s.trim() !== '').join(', ');

  // Emails fallback
  let emailsArray = [];
  if (Array.isArray(req.body['contact_emails[]'])) emailsArray = req.body['contact_emails[]'];
  else if (typeof req.body['contact_emails[]'] === 'string') emailsArray = [req.body['contact_emails[]']];
  const emailsStr = emailsArray.filter(e => e.trim() !== '').join(', ');

  const newClient = db.addClient({
    inn: inn || req.body.search_input,
    company_name: company_name || req.body.search_input,
    email_reports: emailsStr, // Default report email to contacts
    sites: sitesStr,
    saby_contract_id: contract_id,
    saby_contract_number: contract_number
  });

  // Save contacts
  let contactNames = [];
  if (Array.isArray(req.body['contact_names[]'])) contactNames = req.body['contact_names[]'];
  else if (typeof req.body['contact_names[]'] === 'string') contactNames = [req.body['contact_names[]']];
  
  for (let i = 0; i < contactNames.length; i++) {
    const cName = contactNames[i].trim();
    const cEmail = (emailsArray[i] || '').trim();
    if (cName || cEmail) {
      db.addUser({
        client_id: newClient.id,
        email: cEmail || ('user' + Date.now() + '@example.com'),
        username: cName,
        password: Math.random().toString(36).slice(-8), // Generate random pass, they can use OTP
        role: 'user'
      });
    }
  }

  req.session.flash = \`Карточка контрагента \${newClient.company_name} успешно создана!\`;
  res.redirect(\`/client/\${newClient.id}\`);
});`;

code = code.replace(oldAddClient, newAddClient);
fs.writeFileSync('server.js', code);
