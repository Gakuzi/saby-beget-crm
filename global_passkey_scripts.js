import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

// First, remove the existing injected scripts to avoid duplicates
code = code.replace(
  /<script src="https:\/\/unpkg\.com\/@simplewebauthn\/browser\/dist\/bundle\/index\.umd\.min\.js"><\/script>\n<script>\nasync function registerPasskey\(\) {[\s\S]*?<\/script>\n/g,
  ""
);

code = code.replace(
  /<script src="https:\/\/unpkg\.com\/@simplewebauthn\/browser\/dist\/bundle\/index\.umd\.min\.js"><\/script>/g,
  ""
);

// We need to inject both scripts globally into </head>
const globalScripts = `
<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
<script>
async function registerPasskey() {
  try {
    const resp = await fetch('/webauthn/generate-reg', { credentials: 'include' });
    if (!resp.ok) {
      if (resp.status === 401) throw new Error('Не авторизован');
      throw new Error('Failed to generate options');
    }
    const opts = await resp.json();
    if (opts.error) throw new Error(opts.error);
    
    const attResp = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON: opts });
    
    const verifyResp = await fetch('/webauthn/verify-reg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attResp),
      credentials: 'include'
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
</head>`;

code = code.split('</head>').join(globalScripts);

fs.writeFileSync('server.js', code);
