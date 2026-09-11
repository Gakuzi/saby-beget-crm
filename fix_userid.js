import fs from 'fs';
let code = fs.readFileSync('webauthn_routes.js', 'utf8');

code = code.replace(
  "userID: String(admin.id), // must be a string or buffer",
  "userID: new Uint8Array(Buffer.from(String(admin.id))), // must be a Uint8Array"
);

fs.writeFileSync('webauthn_routes.js', code);
