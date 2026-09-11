import fs from 'fs';
let code = fs.readFileSync('webauthn_routes.js', 'utf8');

// The new SimpleWebAuthn version returns a Uint8Array for credentialPublicKey directly.
// Let's check how we convert it to base64.
// Also credentialPublicKey might be called something else or we might be passing undefined somewhere.
// Let's log what we get in registrationInfo before trying to Buffer.from it.
