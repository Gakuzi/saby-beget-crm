import fs from 'fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('src/server.js', 'utf8');
const match = code.match(/res\.send\(`([\s\S]*?)`\);/);
if (match) {
    const html = match[1];
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    const ids = [
        'cfg-saby-client-id', 'cfg-saby-app-secret', 'cfg-saby-secret-key', 'cfg-saby-key-status',
        'cfg-beget-login', 'cfg-beget-pass', 'cfg-beget-pass-status',
        'cfg-backup-secret', 'cfg-backup-email',
        'cfg-smtp-host', 'cfg-smtp-port', 'cfg-smtp-user', 'cfg-smtp-from-email', 'cfg-smtp-from-name', 'cfg-admin-notify-email',
        'cfg-smtp-pass', 'cfg-smtp-pass-status'
    ];
    
    for (const id of ids) {
        if (!doc.getElementById(id)) {
            console.log("NULL ELEMENT FOUND:", id);
        }
    }
    console.log("Check complete.");
} else {
    console.log("Regex didn't match.");
}
