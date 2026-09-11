import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const oldLogout = `app.get('/logout', (req, res) => {
  res.redirect('/');
});`;

const newLogout = `app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});`;

code = code.replace(oldLogout, newLogout);
fs.writeFileSync('server.js', code);
