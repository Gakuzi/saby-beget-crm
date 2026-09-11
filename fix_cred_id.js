import fs from 'fs';
let code = fs.readFileSync('webauthn_routes.js', 'utf8');

code = code.replace(
  "credentialID: passkey.id,",
  "credentialID: new Uint8Array(Buffer.from(passkey.id, 'base64url')),"
);

fs.writeFileSync('webauthn_routes.js', code);
