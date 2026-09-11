import fs from 'fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('src/server.js', 'utf8');
const match = code.match(/res\.send\(`([\s\S]*?)`\);/);
const html = match[1];
console.log(html.substring(0, 100));
console.log("IndexOf cfg-saby-client-id:", html.indexOf('cfg-saby-client-id'));
