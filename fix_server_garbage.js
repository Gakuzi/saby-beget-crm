import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const marker = "// Secure Client Portal Entry";
const endMarker = "// API endpoint to create ticket from client portal (with contact attribution & admin email alert)";

const startIndex = code.indexOf(marker);
const endIndex = code.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const newCode = `// Secure Client Portal Entry
app.get('/portal/t/:token', async (req, res) => {
  const token = req.params.token;
  
  // 1. Check if token belongs to a Client (Admin Preview Mode)
  const clientByToken = db.getClientByToken(token);
  if (clientByToken) {
    if (!req.session.admin_id) {
      return res.status(403).send('Доступ к предпросмотру запрещен. Вы не авторизованы как администратор.');
    }
    return res.send(renderPortalPage({
      client: clientByToken,
      contact: null,
      isAdminPreview: true,
      token,
      activeTab: req.query.tab || 'home',
      reqQuery: req.query
    }));
  }

  // 2. Check if token belongs to a Contact (Actual Client Access)
  const contact = db.getContactByToken(token);
  if (!contact) {
    return res.status(404).send(\`<!doctype html>
      <html lang="ru">
      <head><meta charset="utf-8"><title>Ссылка недействительна</title></head>
      <body style="font-family:sans-serif; padding:40px; text-align:center;">
        <h2>Ссылка недействительна или устарела.</h2>
        <p>Обратитесь к администратору для получения новой ссылки.</p>
      </body>
      </html>\`);
  }

  const client = db.getClientById(contact.client_id);
  
  // If contact is already logged in via session
  if (req.session.portalContactId && String(req.session.portalContactId) === String(contact.id)) {
    return res.send(renderPortalPage({
      client,
      contact,
      token: contact.token,
      activeTab: req.query.tab || 'home',
      reqQuery: req.query
    }));
  }

  // Otherwise, require 2FA Verification
  const { code } = db.createVerificationCode(contact.id);
  const mailRes = await mailer.sendLoginVerificationCode({
    toEmail: contact.email,
    contactName: contact.name,
    companyName: client ? client.company_name : 'Контрагент',
    code
  });
  
  return res.send(renderPortalVerifyPage({
    contact,
    client,
    token: contact.token,
    simulatedCode: mailRes.simulated ? code : null
  }));
});

// Alias for old public link structure just in case
app.get('/public/client/:token', (req, res) => {
  res.redirect('/portal/t/' + req.params.token);
});

`;
  code = code.substring(0, startIndex) + newCode + code.substring(endIndex);
  fs.writeFileSync('server.js', code);
  console.log('Fixed garbage');
} else {
  console.log('Could not find markers');
}
