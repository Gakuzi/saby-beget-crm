import fs from 'fs';
let code = fs.readFileSync('src/server.js', 'utf8');

const regex = /function requireAdmin\(req, res, next\) \{([^}]+)const nextUrl = req\.originalUrl;\s*res\.redirect\('\/login\?next=' \+ encodeURIComponent\(nextUrl\)\);\s*\}/s;

code = code.replace(regex, (match, p1) => {
  return `function requireAdmin(req, res, next) {${p1}let nextUrl = req.originalUrl;
  if (req.method !== 'GET') {
    if (nextUrl.includes('/update_full')) {
      nextUrl = nextUrl.replace('/update_full', '');
    } else {
      nextUrl = '/';
    }
  }
  res.redirect('/login?next=' + encodeURIComponent(nextUrl));
}`;
});

// Also fix the CSP
code = code.replace(
  /res\.setHeader\('Content-Security-Policy', "default-src \* 'unsafe-inline' 'unsafe-eval' data: blob:; img-src \* data: blob:; font-src \* data:;"\);/,
  "res.setHeader('Content-Security-Policy', \"default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https:;\");"
);

fs.writeFileSync('src/server.js', code);
