import fs from 'fs';
let code = fs.readFileSync('src/server.js', 'utf8');
code = code.replace('.modal-overlay {', '.modal-overlay {\n      position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px);\n      display: none; align-items: flex-start; justify-content: center; z-index: 1000; padding: 20px; overflow-y: auto;\n    }\n    .modal-overlay.active { display: flex; }\n    /*');
code = code.replace('.modal-card {', '*/\n    .modal-card {\n      background: #ffffff; border-radius: 16px; max-width: 620px; width: 100%; padding: 24px;\n      box-shadow: 0 20px 50px rgba(0,0,0,0.25); box-sizing: border-box; margin: auto;\n    }');
code = code.replace(/max-height: 90vh; overflow-y: auto;/g, '/*max-height: 90vh;*/');
code = code.replace('flex-direction: column; align-items: stretch; gap: 12px;', 'flex-direction: column; align-items: stretch; gap: 12px; margin-top: 10px;');
fs.writeFileSync('src/server.js', code);
