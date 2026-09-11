import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const oldStyleEnd = `    .toast {
      position: fixed; bottom: 20px; right: 20px; background: #1e1b4b; color: #fff;
      padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3); display: none; z-index: 2000;
    }
  </style>`;

const newStyleEnd = `    .toast {
      position: fixed; bottom: 20px; right: 20px; background: #1e1b4b; color: #fff;
      padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3); display: none; z-index: 2000;
    }
    .modal-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    
    @media (max-width: 768px) {
      body { padding: 10px; }
      .container { padding: 16px; border-radius: 8px; }
      .header-bar { flex-direction: column; align-items: stretch; gap: 12px; }
      .actions-bar { flex-direction: column; align-items: stretch; }
      .btn { justify-content: center; width: 100%; box-sizing: border-box; }
      .modal-card { width: 100%; padding: 16px; max-height: 90vh; overflow-y: auto; }
      .modal-grid-2 { grid-template-columns: 1fr; gap: 8px; }
      table, thead, tbody, th, td, tr { display: block; }
      thead tr { position: absolute; top: -9999px; left: -9999px; }
      tr { border: 1px solid #ccc; margin-bottom: 10px; }
      td { border: none; border-bottom: 1px solid #eee; position: relative; padding-left: 50%; }
      td:before { position: absolute; top: 12px; left: 10px; width: 45%; padding-right: 10px; white-space: nowrap; font-weight: 600; color: #6b5a57; }
      td:nth-of-type(1):before { content: "Компания"; }
      td:nth-of-type(2):before { content: "ИНН"; }
      td:nth-of-type(3):before { content: "Сервер/Beget"; }
      td:nth-of-type(4):before { content: "Панель"; }
    }
  </style>`;

code = code.replace(oldStyleEnd, newStyleEnd);

// Replace inline grid with class
code = code.replace(/<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">/g, '<div class="modal-grid-2" style="margin-bottom: 12px;">');
code = code.replace(/<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">/g, '<div class="modal-grid-2">');

fs.writeFileSync('server.js', code);
