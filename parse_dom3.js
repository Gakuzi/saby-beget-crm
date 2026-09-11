import fs from 'fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('src/server.js', 'utf8');
const match = code.match(/app\.get\('\/',.*?res\.send\(`([\s\S]*?)`\);/s);
if (match) {
    const html = match[1];
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    const ids = [
        'cfg-saby-client-id', 'cfg-smtp-from-name'
    ];
    
    for (const id of ids) {
        if (!doc.getElementById(id)) {
            console.log("NULL ELEMENT:", id);
        } else {
            console.log("FOUND ELEMENT:", id);
        }
    }
} else {
    console.log("Not found.");
}
