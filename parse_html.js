import fs from 'fs';
let html = fs.readFileSync('src/server.js', 'utf8');
const idMatch = html.match(/id="cfg-[^"]+"/g);
console.log(idMatch.join('\n'));
