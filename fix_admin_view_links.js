import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

code = code.replace(
  '<a href="/portal/${client.id}" target="_blank" class="btn btn-portal" title="Открыть персональный клиентский портал">',
  '<a href="/portal/t/${client.active_token || \'\'}" target="_blank" class="btn btn-portal" title="Открыть персональный клиентский портал (как клиент)">'
);

code = code.replace(
  "const url = window.location.origin + '/public/client/${client.active_token || ''}';",
  "const url = window.location.origin + '/portal/t/${client.active_token || ''}';"
);

fs.writeFileSync('admin_view.js', code);
