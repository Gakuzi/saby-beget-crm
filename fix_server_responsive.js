import fs from 'fs';
let code = fs.readFileSync('src/server.js', 'utf8');

// Add favicon to the main dashboard
code = code.replace('<head>\n  <meta charset="UTF-8">', '<head>\n  <meta charset="UTF-8">\n  <link rel="icon" href="/photo_2026-09-14_14-16-17.jpg">');

// Add responsive container and table wrappers
// Dashboard tables
code = code.replace(/<table/g, '<div class="table-responsive" style="overflow-x: auto; -webkit-overflow-scrolling: touch;"><table');
code = code.replace(/<\/table>/g, '</table></div>');

fs.writeFileSync('src/server.js', code);
