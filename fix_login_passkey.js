import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  "const resp = await fetch('/webauthn/generate-auth');",
  "const resp = await fetch('/webauthn/generate-auth', { credentials: 'include' });"
);

code = code.replace(
  "const verifyResp = await fetch('/webauthn/verify-auth', {",
  "const verifyResp = await fetch('/webauthn/verify-auth', {\n            credentials: 'include',"
);

fs.writeFileSync('server.js', code);
