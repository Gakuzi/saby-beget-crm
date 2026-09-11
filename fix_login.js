import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /const adminId = db\.verifyAdminCredentials\(login, password\);\n  if \(!adminId\) \{/,
  "const admin = db.verifyAdminCredentials(login, password);\n  if (!admin) {"
);

code = code.replace(
  /req\.session\.admin_id = adminId;\n  const adminData = db\.db\.prepare\('SELECT username, email FROM admin_users WHERE id = \?'\)\.get\(adminId\);\n  req\.session\.crm_admin_user = adminData\.username || adminData\.email;\n  \n  db\.setAdminLastLogin\(adminId\);/,
  "req.session.admin_id = admin.id;\n  req.session.crm_admin_user = admin.username || admin.email;\n  \n  db.setAdminLastLogin(admin.id);"
);

fs.writeFileSync('server.js', code);
