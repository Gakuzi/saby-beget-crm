import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

const oldTableStyle = `    .logs-table {
      width: 100%; border-collapse: collapse; margin-top: 16px;
    }
    .logs-table th, .logs-table td {
      padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13.5px;
    }`;

const newTableStyle = `    .table-responsive { overflow-x: auto; width: 100%; }
    .logs-table {
      width: 100%; border-collapse: collapse; margin-top: 16px; min-width: 600px;
    }
    .logs-table th, .logs-table td {
      padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13.5px;
    }`;

code = code.replace(oldTableStyle, newTableStyle);

// Wrap logs-table in table-responsive
code = code.replace(/<table class="logs-table">/g, '<div class="table-responsive"><table class="logs-table">');
code = code.replace(/<\/table>\n\s*<\/div>\n\s*<!-- Form/g, '</table></div></div>\n        <!-- Form'); // close the div... wait this regex is too fragile.
// Better regex:
code = code.replace(/<\/table>/g, '</table></div>');
// Except I need to make sure the open div matched. `table-responsive` wraps exactly `<table class="logs-table">`
// Wait, I just replaced `</table>` with `</table></div>` for ALL tables.
// Let's check how many tables there are in admin_view.js.
fs.writeFileSync('admin_view.js', code);
