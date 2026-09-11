import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /<a href="\/change-password" style="font-size:13px; font-weight:600;">🔑 Пароль<\/a>/,
  `<a href="#" onclick="registerPasskey()" style="font-size:13px; font-weight:600; color:#10b981;">🛡️ Создать Passkey</a>
        <a href="/change-password" style="font-size:13px; font-weight:600;">🔑 Пароль</a>`
);

// We need to inject the registerPasskey script into the dashboard HTML output.
// We can append it before </body></html>
const scriptToAppend = `
<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
<script>
async function registerPasskey() {
  try {
    const resp = await fetch('/webauthn/generate-reg');
    if (!resp.ok) throw new Error('Failed to generate options');
    const opts = await resp.json();
    if (opts.error) throw new Error(opts.error);
    
    const attResp = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: opts });
    
    const verifyResp = await fetch('/webauthn/verify-reg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp),
    });
    
    const verification = await verifyResp.json();
    if (verification.verified) {
      alert('Ключ (Passkey) успешно добавлен! Теперь вы можете входить по отпечатку или Face ID.');
    } else {
      alert('Ошибка при сохранении ключа: ' + (verification.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    console.error(e);
    alert('Не удалось зарегистрировать ключ: ' + e.message);
  }
}
</script>
`;

code = code.replace(
  /<\/body>\n<\/html>`\);\n}\);/g,
  scriptToAppend + "</body>\n</html>`);\n});"
);

fs.writeFileSync('server.js', code);
