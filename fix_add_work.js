import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

code = code.replace(
  /function openAddWorkModal\(\) \{[\s\S]*?el\.focus\(\);\n\s*\}\n\s*\}/,
  `function openAddWorkModal() {
      const el = document.querySelector('textarea[name="description"]');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      } else {
        window.location.href = "?tab=works#add_work";
      }
    }`
);

// Add an ID to the form to scroll to it
code = code.replace(
  /<form action="\/client\/\$\{client.id\}\/add_log_advanced"/,
  '<form id="add_work" action="/client/${client.id}/add_log_advanced"'
);

// Add script to automatically scroll to the form if the URL has #add_work
const scriptToAppend = `
    document.addEventListener("DOMContentLoaded", function() {
      if(window.location.hash === '#add_work') {
        const el = document.querySelector('textarea[name="description"]');
        if(el) {
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus();
          }, 300);
        }
      }
    });
`;

code = code.replace(/function openAddWorkModal/, scriptToAppend + '\n    function openAddWorkModal');

fs.writeFileSync('admin_view.js', code);
