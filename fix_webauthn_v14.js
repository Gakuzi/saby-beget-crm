import fs from 'fs';
let code = fs.readFileSync('webauthn_routes.js', 'utf8');

code = code.replace(
  "const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;",
  "const { credentialDeviceType, credentialBackedUp, credential } = verification.registrationInfo;\n        const credentialPublicKey = credential ? credential.publicKey : (verification.registrationInfo.credentialPublicKey || new Uint8Array());\n        const counter = credential ? credential.counter : (verification.registrationInfo.counter || 0);"
);

fs.writeFileSync('webauthn_routes.js', code);
