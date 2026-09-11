import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const oldClientGet = `// Client card (Apple Liquid Glass)
app.get('/client/:id', (req, res) => {
  const client = db.getClientById(req.params.id);
  if (!client) {
    return res.status(404).send('Клиент не найден. <a href="/">Вернуться</a>');
  }
  res.send(renderAdminClientPage({
    client,
    activeTab: req.query.tab || 'works',
    flashMessage: res.locals.flash || req.query.msg,
    reqQuery: req.query,
    reqHost: req.get('host')
  }));
});`;

const newClientGet = `// Client card (Apple Liquid Glass)
app.get('/client/:id', (req, res) => {
  const client = db.getClientById(req.params.id);
  if (!client) {
    return res.status(404).send('Клиент не найден. <a href="/">Вернуться</a>');
  }
  
  // Create or get the master token for this client's portal
  client.active_token = db.createAccessLink(client.id);

  res.send(renderAdminClientPage({
    client,
    activeTab: req.query.tab || 'works',
    flashMessage: res.locals.flash || req.query.msg,
    reqQuery: req.query,
    reqHost: req.get('host')
  }));
});`;

code = code.replace(oldClientGet, newClientGet);
fs.writeFileSync('server.js', code);
