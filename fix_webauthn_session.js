import fs from 'fs';
let code = fs.readFileSync('webauthn_routes.js', 'utf8');

code = code.replace(
  "req.session.currentChallenge = options.challenge;",
  "if (!req.session) { console.error('SESSION IS UNDEFINED IN generate-auth!'); res.status(500).json({error: 'Session not initialized'}); return; }\n      req.session.currentChallenge = options.challenge;"
);

code = code.replace(
  "req.session.currentChallenge = options.challenge;",
  "if (!req.session) { console.error('SESSION IS UNDEFINED IN generate-reg!'); res.status(500).json({error: 'Session not initialized'}); return; }\n      req.session.currentChallenge = options.challenge;"
);

fs.writeFileSync('webauthn_routes.js', code);
