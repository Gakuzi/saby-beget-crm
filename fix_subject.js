import fs from 'fs';
let code = fs.readFileSync('mailer.js', 'utf8');

// Change subject to explicitly contain words that trigger OTP detection
code = code.replace(
  /subject: \`Код авторизации: \$\{code\} \- CRM Администратора\`/,
  "subject: `${code} is your verification code`"
);

code = code.replace(
  /subject: \`Код авторизации: \$\{code\} — Личный кабинет \$\{companyName\}\`/,
  "subject: `${code} is your verification code`"
);

fs.writeFileSync('mailer.js', code);
