import fs from 'fs';

function addFavicon(filePath) {
  if (fs.existsSync(filePath)) {
    let code = fs.readFileSync(filePath, 'utf8');
    if (!code.includes('<link rel="icon" href="/photo_2026-09-14_14-16-17.jpg">')) {
       code = code.replace(/<head>/g, '<head>\n  <link rel="icon" href="/photo_2026-09-14_14-16-17.jpg">');
       fs.writeFileSync(filePath, code);
    }
  }
}

addFavicon('src/views/portal_view.js');
addFavicon('src/server.js');
addFavicon('portal.html');
addFavicon('output.html');

