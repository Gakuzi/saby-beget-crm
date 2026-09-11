import fs from 'fs';
let code = fs.readFileSync('webauthn_routes.js', 'utf8');

code = code.replace(
  "        const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;",
  "        const { credentialPublicKey, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;\n        const counter = verification.registrationInfo.counter || 0;"
);

// We should use credentialPublicKey directly if it's already a Uint8Array, but the error is "The first argument must be of type string or an instance of Buffer... Received undefined".
// This means verification.registrationInfo.credentialPublicKey is undefined.
// In the latest version of simplewebauthn, the field is often called `credential.publicKey` or something else?
// Wait, the error could be `response.id`? No, response.id is from the client.
// Let's print out what `registrationInfo` contains if we can. 
// Or maybe the API changed. Let's look at simplewebauthn docs.
