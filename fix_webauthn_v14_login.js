import fs from 'fs';
let code = fs.readFileSync('webauthn_routes.js', 'utf8');

// Replace authenticator with credential for v14
code = code.replace(
  `        authenticator: {
          credentialID: new Uint8Array(Buffer.from(passkey.id, 'base64url')),
          credentialPublicKey: Buffer.from(passkey.public_key, 'base64'),
          counter: passkey.counter,
          transports: passkey.transports ? passkey.transports.split(',') : undefined,
        },`,
  `        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(Buffer.from(passkey.public_key, 'base64')),
          counter: passkey.counter,
          transports: passkey.transports ? passkey.transports.split(',') : undefined,
        },`
);

fs.writeFileSync('webauthn_routes.js', code);
