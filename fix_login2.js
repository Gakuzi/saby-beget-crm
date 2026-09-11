import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const oldLogin = code.substring(
  code.indexOf("app.post('/login', (req, res) => {"),
  code.indexOf("app.post('/login_otp_request', async (req, res) => {")
);

const newLogin = `app.post('/login', (req, res) => {
  const { login, password, next } = req.body;
  const admin = db.verifyAdminCredentials(login, password);
  if (!admin) {
    return res.redirect('/login?msg=' + encodeURIComponent('Неверный логин или пароль') + '&next=' + encodeURIComponent(next || '/'));
  }
  
  req.session.admin_id = admin.id;
  req.session.crm_admin_user = admin.username || admin.email;
  db.setAdminLastLogin(admin.id);
  
  res.redirect(next || '/');
});

const otps = new Map(); // Store OTPs in memory for simplicity

`;

code = code.replace(oldLogin, newLogin);
fs.writeFileSync('server.js', code);
