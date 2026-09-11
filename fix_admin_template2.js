import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');
code = code.replace(
  "const res = await fetch(`/api/client/${client.id}/test-ssh`, {",
  "const res = await fetch('/api/client/${client.id}/test-ssh', {"
);
fs.writeFileSync('admin_view.js', code);
