import fs from 'fs';
let code = fs.readFileSync('mailer.js', 'utf8');

// There is also an admin verification code
code = code.replace(
  /subject: \`🔐 Код входа в панель администратора CRM: \$\{code\}\`/,
  "subject: `${code} is your verification code`"
);

fs.writeFileSync('mailer.js', code);
