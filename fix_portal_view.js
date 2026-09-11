import fs from 'fs';
let code = fs.readFileSync('portal_view.js', 'utf8');

code = code.replace(
  /const hoursUsed = summary\.hours\.used;\n  const hoursPercent = summary\.hours\.percent;/,
  "const hoursUsed = summary.hours_used || 0;\n  const hoursPercent = Math.min(100, (hoursUsed / planHours) * 100).toFixed(1);"
);

fs.writeFileSync('portal_view.js', code);
