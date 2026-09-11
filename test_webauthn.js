import fs from 'fs';
let code = fs.readFileSync('webauthn_routes.js', 'utf8');

code = code.replace(
  "    try {\n      const admin = db.db.prepare('SELECT id, username, email FROM admin_users WHERE id = ?').get(req.session.admin_id);",
  "    try {\n      console.log('Generating reg options for admin:', req.session.admin_id);\n      const admin = db.db.prepare('SELECT id, username, email FROM admin_users WHERE id = ?').get(req.session.admin_id);\n      console.log('Admin found:', admin);"
);

fs.writeFileSync('webauthn_routes.js', code);
