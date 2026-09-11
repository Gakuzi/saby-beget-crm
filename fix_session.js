import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /\/\/ Session configuration/,
  "app.set('trust proxy', 1);\n\n// Session configuration"
);

code = code.replace(
  /cookie: \{ maxAge: 24 \* 60 \* 60 \* 1000 \}/,
  "cookie: { maxAge: 24 * 60 * 60 * 1000, secure: true, sameSite: 'none' }"
);

fs.writeFileSync('server.js', code);
