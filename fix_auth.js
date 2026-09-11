import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

// Replace the bypass logic with real auth
const authBlock = `
function requireAdmin(req, res, next) {
  // Allow open access to portal, login, health, api auth routes
  const openRoutes = ['/login', '/login_otp', '/healthz', '/portal'];
  if (openRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  
  // Also allow static assets if any, though we don't have a static dir mapped here
  
  if (req.session && req.session.admin_id) {
    return next();
  }
  
  // Not logged in, save next url and redirect
  const nextUrl = req.originalUrl;
  res.redirect('/login?next=' + encodeURIComponent(nextUrl));
}
`;

code = code.replace(/function requireAdmin[\s\S]*?return next\(\);\n\}/, authBlock);

fs.writeFileSync('server.js', code);
