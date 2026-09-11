import fs from 'fs';
let code = fs.readFileSync('mailer.js', 'utf8');

// I see that only one subject was changed successfully, let's fix the second one too
code = code.replace(
  /subject: \`Код подтверждения \$\{code\} для входа в Личный кабинет — \$\{companyName\}\`/,
  "subject: `${code} is your verification code`"
);

fs.writeFileSync('mailer.js', code);
