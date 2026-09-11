import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const loginUIold = `<form id="form-otp-verify" method="post" action="/login_otp_verify" style="margin-top:20px; padding-top:20px; border-top:1px dashed #cbd5e1;">
        <input type="hidden" name="next" value="\${nextUrl}">
        <input type="hidden" name="email" value="\${req.query.email}">
        <label>Код из письма:</label>
        <input type="text" name="code" required placeholder="123456" style="letter-spacing:4px; text-align:center; font-weight:bold; font-size:18px;">
        <button type="submit" style="background:#10b981;">Подтвердить код</button>
      </form>
      <script>
        document.getElementById('form-pwd').style.display = 'none';
        document.getElementById('form-otp-req').style.display = 'none';
        document.querySelector('.tabs').style.display = 'none';
      </script>
    \` : ''}

    <script>
      function switchTab(t) {
        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
        if(t === 'pwd') {
          document.getElementById('form-pwd').style.display = 'block';
          document.getElementById('form-otp-req').style.display = 'none';
          document.querySelectorAll('.tab')[0].classList.add('active');
        } else {
          document.getElementById('form-pwd').style.display = 'none';
          document.getElementById('form-otp-req').style.display = 'block';
          document.querySelectorAll('.tab')[1].classList.add('active');
        }
      }
    </script>
  </div>
</body>
</html>\`);
});`;

const loginUInew = `<form id="form-otp-verify" method="post" action="/login_otp_verify" style="margin-top:20px; padding-top:20px; border-top:1px dashed #cbd5e1;">
        <input type="hidden" name="next" value="\${nextUrl}">
        <input type="hidden" name="email" value="\${req.query.email}">
        <label>Код из письма:</label>
        <input type="text" name="code" required placeholder="123456" style="letter-spacing:4px; text-align:center; font-weight:bold; font-size:18px;">
        <button type="submit" style="background:#10b981;">Подтвердить код</button>
      </form>
      <script>
        document.getElementById('form-pwd').style.display = 'none';
        document.getElementById('form-otp-req').style.display = 'none';
        document.querySelector('.tabs').style.display = 'none';
      </script>
    \` : ''}

    <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Или используйте безопасный вход</p>
      <button type="button" onclick="loginWithPasskey()" style="background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
        Вход по Face ID / Touch ID
      </button>
      <p id="passkey-error" style="color: #dc2626; font-size: 13px; margin-top: 8px; display: none;"></p>
    </div>

    <script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
    <script>
      function switchTab(t) {
        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
        if(t === 'pwd') {
          document.getElementById('form-pwd').style.display = 'block';
          document.getElementById('form-otp-req').style.display = 'none';
          document.querySelectorAll('.tab')[0].classList.add('active');
        } else {
          document.getElementById('form-pwd').style.display = 'none';
          document.getElementById('form-otp-req').style.display = 'block';
          document.querySelectorAll('.tab')[1].classList.add('active');
        }
      }

      async function loginWithPasskey() {
        const errorEl = document.getElementById('passkey-error');
        errorEl.style.display = 'none';
        try {
          const resp = await fetch('/webauthn/generate-auth');
          const opts = await resp.json();
          if (opts.error) throw new Error(opts.error);
          
          const asseResp = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: opts });
          
          const verifyResp = await fetch('/webauthn/verify-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(asseResp),
          });
          
          const verification = await verifyResp.json();
          if (verification.verified) {
            window.location.href = "\${nextUrl}";
          } else {
            throw new Error(verification.error || 'Ошибка проверки ключа');
          }
        } catch (err) {
          console.error(err);
          errorEl.innerText = err.message || 'Не удалось выполнить вход по ключу';
          errorEl.style.display = 'block';
        }
      }
    </script>
  </div>
</body>
</html>\`);
});`;

code = code.replace(loginUIold, loginUInew);

// Ensure required session save on OTP verification
code = code.replace(
  `  db.setAdminLastLogin(admin.id);\n  \n  res.redirect(next || '/');`,
  `  db.setAdminLastLogin(admin.id);\n  req.session.save(() => { res.redirect(next || '/'); });`
);

// Ensure required session save on pwd login
code = code.replace(
  `  db.setAdminLastLogin(admin.id);\n  \n  res.redirect(next || '/');\n});`,
  `  db.setAdminLastLogin(admin.id);\n  req.session.save(() => { res.redirect(next || '/'); });\n});`
);

fs.writeFileSync('server.js', code);
