import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

// Remove setupWebAuthn(app); from line 22
code = code.replace("const app = express();\nsetupWebAuthn(app);", "const app = express();");

// Insert setupWebAuthn(app); after session middleware
const sessionMiddlewareEnd = `app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});`;

code = code.replace(
  sessionMiddlewareEnd,
  sessionMiddlewareEnd + "\n\nsetupWebAuthn(app);"
);

fs.writeFileSync('server.js', code);
