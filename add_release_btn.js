import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

const syncBtnBlock = `<button type="button" id="modal-push-btn" onclick="executeGitHubPush()"`;
const releaseBtn = `<button type="button" id="modal-release-btn" onclick="executeGitHubRelease()" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <span>📦</span> Выпустить релиз v1.0.0
        </button>`;

code = code.replace(syncBtnBlock, releaseBtn + '\\n        ' + syncBtnBlock);

const jsCode = `
    async function executeGitHubRelease() {
      const btn = document.getElementById('modal-release-btn');
      const box = document.getElementById('modal-result');
      btn.disabled = true;
      btn.innerHTML = 'Создание...';
      box.style.display = 'block';
      box.innerHTML = 'Запрос к GitHub API...';
      box.style.background = '#eff6ff';
      box.style.color = '#1e3a8a';
      
      try {
        const res = await fetch('/api/settings/github/release', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: 'v1.0.0', name: 'Первый стабильный релиз', body: 'Релиз включает полный функционал CRM, WebAuthn авторизацию, встроенный Web-SSH терминал и базу данных SQLite.' })
        });
        const data = await res.json();
        
        if (data.ok) {
          box.style.background = '#ecfdf5';
          box.style.color = '#065f46';
          box.innerHTML = '<strong>✅ Успешно!</strong> Релиз v1.0.0 опубликован на GitHub.<br><a href="' + data.url + '" target="_blank" style="color:#0284c7; text-decoration:underline;">Посмотреть релиз</a>';
        } else {
          box.style.background = '#fef2f2';
          box.style.color = '#991b1b';
          box.innerHTML = '<strong>❌ Ошибка:</strong> ' + (data.error || 'Сбой при публикации релиза');
        }
      } catch (err) {
        box.style.background = '#fef2f2';
        box.style.color = '#991b1b';
        box.innerHTML = '<strong>❌ Сетевая ошибка:</strong> ' + err.message;
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>📦</span> Выпустить релиз v1.0.0';
      }
    }
`;

code = code.replace("</script>", jsCode + "\\n  </script>");
fs.writeFileSync('admin_view.js', code);
