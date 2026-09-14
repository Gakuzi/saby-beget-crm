import fs from 'fs';
let code = fs.readFileSync('src/server.js', 'utf8');

const cspMiddleware = `app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob:; font-src * data:;");
  next();
});

app.use(requireAdmin);`;

code = code.replace('app.use(requireAdmin);', cspMiddleware);
fs.writeFileSync('src/server.js', code);
