import fs from 'fs';
let code = fs.readFileSync('src/server.js', 'utf8');

const regex = /\/\* Modal \*\/.+?\.toast \{/s;
const newCss = `/* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px);
      display: none; align-items: flex-start; justify-content: center; z-index: 1000; padding: 20px; overflow-y: auto;
    }
    .modal-card {
      background: #ffffff; border-radius: 16px; max-width: 620px; width: 100%; padding: 24px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.25); box-sizing: border-box; margin: 40px auto;
    }
    .toast {`;

code = code.replace(regex, newCss);

// Also fix the Saby Settings modal max-height line
code = code.replace(/<div class="modal-card" style="max-width: 750px;[^>]*>/, '<div class="modal-card" style="max-width: 750px; width: 100%; box-sizing: border-box;">');

fs.writeFileSync('src/server.js', code);
