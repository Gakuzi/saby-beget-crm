import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

const targetSSH = '<h3 style="font-size:16px; font-weight:700; color:#1e1b4b; display:flex; align-items:center; gap:8px;">\n                  <span>🖥️</span> Доступ по SSH к серверу\n                </h3>';
const replaceSSH = `<h3 style="font-size:16px; font-weight:700; color:#1e1b4b; display:flex; align-items:center; justify-content:space-between; width:100%;">
                  <span style="display:flex; align-items:center; gap:8px;"><span>🖥️</span> Доступ по SSH к серверу</span>
                  <button type="button" id="btn-test-ssh-connection" onclick="testSshConnection()" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer;">⚡ Проверить соединение</button>
                </h3>`;

code = code.replace(targetSSH, replaceSSH);

const jsScriptAppend = `
    async function testSshConnection() {
      const btn = document.getElementById('btn-test-ssh-connection');
      if (!btn) return;
      btn.innerHTML = '⏳ Подключение...';
      btn.disabled = true;

      const host = document.getElementById('inp_ssh_host').value;
      const port = document.getElementById('inp_ssh_port').value;
      const user = document.getElementById('inp_ssh_user').value;
      const pass = document.getElementById('inp_ssh_pass').value;
      const pkey = document.getElementById('inp_ssh_key').value;

      try {
        const res = await fetch('/api/client/' + ${'`${client.id}`'} + '/test-ssh', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ host, port, user, pass, key: pkey })
        });
        const data = await res.json();
        if (data.ok) {
          btn.innerHTML = '✅ Успешно (ОК)';
          btn.style.background = '#dcfce7';
          btn.style.color = '#166534';
          btn.style.borderColor = '#bbf7d0';
        } else {
          btn.innerHTML = '❌ Ошибка';
          btn.style.background = '#fee2e2';
          btn.style.color = '#991b1b';
          btn.style.borderColor = '#fecaca';
          alert('Ошибка SSH: ' + data.error);
        }
      } catch (err) {
        alert('Сбой запроса: ' + err.message);
        btn.innerHTML = '❌ Сбой';
      } finally {
        setTimeout(() => {
          btn.innerHTML = '⚡ Проверить соединение';
          btn.disabled = false;
          btn.style.background = '#e0f2fe';
          btn.style.color = '#0284c7';
          btn.style.borderColor = '#bae6fd';
        }, 5000);
      }
    }
  </script>
`;

code = code.replace("</script>", jsScriptAppend);

fs.writeFileSync('admin_view.js', code);
