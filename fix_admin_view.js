import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

// Remove the local declaration that conflicts with the parameter
code = code.replace(/const clientSites = db\.getClientSites\(cId\);\n/g, '');

// Also we need to get hosting accounts if they are not passed or if we just want to fetch them directly
// Let's ensure hostingAccounts is available
code = code.replace(
  /const creds = db\.getClientCredentials\(cId, { mask: false }\);/,
  "const creds = db.getClientCredentials(cId, { mask: false });\n  const localHostingAccounts = db.getHostingAccounts ? db.getHostingAccounts(cId) : hostingAccounts;\n  const localClientSites = db.getSites ? db.getSites(cId) : clientSites;"
);

// We need to rename the parameter variables where they conflict, or just use the local ones.
// I'll replace all clientSites with localClientSites in the file.
// And hostingAccounts with localHostingAccounts
code = code.replace(/clientSites/g, 'localClientSites');
code = code.replace(/hostingAccounts/g, 'localHostingAccounts');
// Fix the parameter signature back or just use the locals
code = code.replace(/localClientSites = \[\]/g, 'clientSites = []');
code = code.replace(/localHostingAccounts = \[\]/g, 'hostingAccounts = []');

// Fix .domain to .url and .cms to .cms_type
code = code.replace(/s\.domain/g, 's.url');
code = code.replace(/s\.cms/g, 's.cms_type');
code = code.replace(/s\.cms_version/g, "''");
code = code.replace(/s\.php_version/g, "'PHP 8.2'"); // Placeholder

fs.writeFileSync('admin_view.js', code);
