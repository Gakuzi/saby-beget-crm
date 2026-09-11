import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

// 1. Remove all archiveClientAction and restoreClientAction blocks
code = code.replace(/function archiveClientAction[\s\S]*?\}\s*function restoreClientAction[\s\S]*?\}\n/g, '');

// Also remove any standalone ones just in case
code = code.replace(/function archiveClientAction\([^)]*\)\s*\{[\s\S]*?\}\s*(?=function|<\/script>)/g, '');
code = code.replace(/function restoreClientAction\([^)]*\)\s*\{[\s\S]*?\}\s*(?=function|<\/script>)/g, '');


// 2. Inject it before </body> in renderAdminClientPage
const scriptBlock = `
<script>
    function archiveClientAction(id) {
      const reason = prompt('Укажите причину расторжения / архивации договора:', 'Договор завершен / расторгнут');
      if (reason === null) return;
      
      fetch('/api/client/' + id + '/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason })
      })
      .then(r => r.json())
      .then(res => {
        if (res.ok) {
          window.location.href = '/';
        } else {
          alert('Ошибка архивации: ' + res.error);
        }
      })
      .catch(e => alert('Ошибка сети: ' + e));
    }
    
    function restoreClientAction(id) {
      if (!confirm('Вы действительно хотите восстановить договор из архива и перевести его в статус "Активный"?')) return;
      
      fetch('/api/client/' + id + '/restore', {
        method: 'POST'
      })
      .then(r => r.json())
      .then(res => {
        if (res.ok) {
          window.location.reload();
        } else {
          alert('Ошибка восстановления: ' + res.error);
        }
      })
      .catch(e => alert('Ошибка сети: ' + e));
    }
</script>
`;

code = code.replace(/<\/body>\s*<\/html>\s*`;\s*\}\s*\/\/\s*Render New Client Page in Apple Liquid Glass/, scriptBlock + '\n</body>\n</html>`;\n}\n\n// Render New Client Page in Apple Liquid Glass');

fs.writeFileSync('admin_view.js', code);
