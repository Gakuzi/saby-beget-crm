import fs from 'fs';
let code = fs.readFileSync('mailer.js', 'utf8');

// The English trigger word 'verification code' or 'authentication code' is often hardcoded in iOS Data Detectors.
// Let's add a clear trigger text in both Russian and English, but keep the English hidden if we want a clean RU UI.
// Actually, Apple's Data Detectors look for:
// "verification code", "authentication code", "security code", "passcode", and "код подтверждения", "код проверки"
// Let's add the exact hidden text: "Verification code: 123456"

const fixAdmin = code.replace(
  /Here is your authentication code:/g,
  'Ваш код подтверждения для входа:'
).replace(
  /<div style="display:none; color:transparent;">Ваш код подтверждения для входа: \$\{code\}<\/div>/g,
  '<div style="display:none; color:transparent; font-size:1px;">Verification code: ${code}</div>'
);

fs.writeFileSync('mailer.js', fixAdmin);
