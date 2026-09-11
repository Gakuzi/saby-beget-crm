import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const headEnd = `</style>
</head>`;

const passkeyScript = `</style>
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
</head>`;

// Only replace the FIRST occurrence which should be the dashboard or one of the main views.
// Wait, the header is defined in `server.js` at line ~480
code = code.replace(headEnd, passkeyScript);

fs.writeFileSync('server.js', code);
