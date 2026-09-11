import fs from 'fs';
let code = fs.readFileSync('webauthn_routes.js', 'utf8');

// Fix passkey retrieval - response.id might need normalization
code = code.replace(
  "const passkey = db.getPasskey(response.id);",
  `// normalize id just in case
      let passkey = db.getPasskey(response.id);
      if (!passkey) {
        // Try looking up by device if we can't find by ID
        const allPasskeys = db.db.prepare('SELECT * FROM admin_passkeys').all();
        passkey = allPasskeys.find(p => p.id === response.id || Buffer.from(p.id, 'base64').toString('base64url') === response.id || p.id === Buffer.from(response.id, 'base64url').toString('base64'));
      }`
);

fs.writeFileSync('webauthn_routes.js', code);
