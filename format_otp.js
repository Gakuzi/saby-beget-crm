import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

// The OTP form should have standard input autocomplete for Apple
code = code.replace(
  /<input type="text" name="code" required placeholder="123456"/g,
  '<input type="text" name="code" required placeholder="123456" autocomplete="one-time-code" inputmode="numeric"'
);

fs.writeFileSync('server.js', code);
