import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const scriptBlock = `
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
</body>
</html>\`);
});`;

// Remove all instances of the injected block and replace them with standard </body>\n</html>`);\n});
code = code.split(scriptBlock).join(`</body>\n</html>\`);\n});`);

// Now inject it ONLY into the app.get('/') route response
// Let's find the closing of the app.get('/') response. 
// Instead of trying to regex it perfectly, let's just append the script to the header.

fs.writeFileSync('server.js', code);
