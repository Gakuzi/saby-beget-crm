import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

const scriptBlock = `
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
`;

// Insert it right before </script> in renderAdminClientPage (around line 3200-3300)
// wait, the safest way is to replace `</script>` with `${scriptBlock}</script>` for the first </script> tag
// since there are two functions (renderAdminClientPage and renderNewClientPage), both return HTML strings with </script>

code = code.replace(/<\/script>\s*<\/body>\s*<\/html>\s*`;\s*\}/, scriptBlock + '\n  </script>\n</body>\n</html>\n`;\n}');

fs.writeFileSync('admin_view.js', code);
