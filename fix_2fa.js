import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(/db\.createVerificationCode\(contact\.id\)/g, 'db.createVerificationCode(contact.email)');
fs.writeFileSync('server.js', code);
