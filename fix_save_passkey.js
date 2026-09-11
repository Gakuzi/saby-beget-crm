import fs from 'fs';
let code = fs.readFileSync('webauthn_routes.js', 'utf8');

code = code.replace(
  "id: credentialID,",
  "id: response.id,"
);

fs.writeFileSync('webauthn_routes.js', code);
