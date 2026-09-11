import fs from 'fs';
let code = fs.readFileSync('webauthn_routes.js', 'utf8');

// The new SimpleWebAuthn library (v10+) returns the public key as `registrationInfo.credential.publicKey` and id as `registrationInfo.credential.id`.
const oldCode = "const { credentialPublicKey, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;\n        const counter = verification.registrationInfo.counter || 0;";
const newCode = `const { credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
        const credentialPublicKey = verification.registrationInfo.credential.publicKey;
        const counter = verification.registrationInfo.credential.counter || 0;`;

code = code.replace(oldCode, newCode);

fs.writeFileSync('webauthn_routes.js', code);
