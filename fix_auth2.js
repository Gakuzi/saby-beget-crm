import fs from 'fs';
let code = fs.readFileSync('src/server.js', 'utf8');

const regex = /function requireAdmin\(req, res, next\) \{.+?res\.redirect\('\/login\?next=' \+ encodeURIComponent\(nextUrl\)\);\s*\}/s;

code = code.replace(regex, `function requireAdmin(req, res, next) {
  const openRoutes = ['/login', '/login_otp', '/healthz', '/portal', '/webauthn', '/photo_'];
  if (openRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  
  if (req.session && req.session.admin_id) {
    return next();
  }
  
  let nextUrl = req.originalUrl;
  if (req.method !== 'GET') {
    if (nextUrl.includes('/update_full')) {
      nextUrl = nextUrl.replace('/update_full', '');
    } else {
      nextUrl = '/';
    }
  }
  res.redirect('/login?next=' + encodeURIComponent(nextUrl));
}`);

fs.writeFileSync('src/server.js', code);
