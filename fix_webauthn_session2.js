import fs from 'fs';
let code = fs.readFileSync('webauthn_routes.js', 'utf8');

code = code.replace(
  /req\.session\.currentChallenge = options\.challenge;/g,
  "if (!req.session) { console.error('SESSION IS UNDEFINED!'); return res.status(500).json({error: 'Session not initialized'}); }\n      req.session.currentChallenge = options.challenge;"
);

fs.writeFileSync('webauthn_routes.js', code);
