import fs from 'fs';
let code = fs.readFileSync('src/views/admin_view.js', 'utf8');

code = code.replace(
  /const sabyDocs = db\.getSabyDocs\(cId\);/,
  'const sabyDocs = db.getSabyDocs(cId);\n  const sabyWorks = db.getSabyWorks(cId);\n  const sabyRequests = db.getSabyRequests(cId);'
);

fs.writeFileSync('src/views/admin_view.js', code);
