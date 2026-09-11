// Admin Login & 2FA View Template
export function renderAdminLoginPage({ error = null, step = 'credentials', email = 'EKlimov84@gmail.com', nextUrl = '/' }) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Вход в панель администратора | Евгений Климов CRM</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at 50% 20%, #ffffff 0%, #f1f5f9 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: #0f172a;
    }
    .login-card {
      width: 100%;
      max-width: 440px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 12px 36px rgba(15, 23, 42, 0.08);
      padding: 36px 32px;
      position: relative;
    }
    .brand-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 22px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 6px 0;
      color: #0f172a;
      letter-spacing: -0.3px;
    }
    .subtitle {
      font-size: 13.5px;
      color: #64748b;
      margin-bottom: 24px;
      line-height: 1.4;
    }
    .alert-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 13px;
      color: #991b1b;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .form-group {
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 6px;
    }
    input[type="text"],
    input[type="password"] {
      width: 100%;
      padding: 11px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      color: #0f172a;
      transition: all 0.15s;
    }
    input[type="text"]:focus,
    input[type="password"]:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }
    .otp-input {
      font-size: 24px !important;
      letter-spacing: 8px !important;
      text-align: center !important;
      font-family: monospace !important;
      font-weight: 800 !important;
    }
    .btn-submit {
      width: 100%;
      padding: 12px;
      background: #0f172a;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s;
      margin-top: 8px;
    }
    .btn-submit:hover {
      background: #1e293b;
    }
    .footer-note {
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      margin-top: 24px;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
    }
    .security-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 12px;
      color: #475569;
      margin-top: 18px;
    }
  </style>
</head>
<body>

  <div class="login-card">
    <div class="brand-icon">🛡️</div>
    <h1>Административная панель</h1>
    <div class="subtitle">Управление инфраструктурой сайтов, договорами и базой данных SQLite</div>

    ${error ? `<div class="alert-error">⚠️ ${error}</div>` : ''}

    ${step === 'credentials' ? `
      <form action="/login" method="POST">
        <input type="hidden" name="next" value="${nextUrl || '/'}">
        <div class="form-group">
          <label for="login_user">Логин администратора или Email</label>
          <input type="text" id="login_user" name="login" value="admin" required autofocus autocomplete="username">
        </div>

        <div class="form-group">
          <label for="login_pass">Пароль учетной записи</label>
          <input type="password" id="login_pass" name="password" required autocomplete="current-password" placeholder="••••••••">
        </div>

        <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
          <input type="checkbox" id="use_2fa" name="use_2fa" value="1" checked style="width: 16px; height: 16px; accent-color: #0f172a;">
          <label for="use_2fa" style="margin-bottom: 0; font-size: 12.5px; color: #475569; cursor: pointer;">
            Двухфакторная защита (код на почту EKlimov84@gmail.com)
          </label>
        </div>

        <button type="submit" class="btn-submit">Войти в систему &rarr;</button>
      </form>
    ` : `
      <form action="/login/verify-otp" method="POST">
        <input type="hidden" name="next" value="${nextUrl || '/'}">
        <div class="form-group">
          <label style="text-align: center; margin-bottom: 10px;">
            Введите 6-значный код подтверждения,<br>отправленный на <strong>${email}</strong>:
          </label>
          <input type="text" name="code" class="otp-input" maxlength="6" pattern="[0-9]{6}" required autofocus placeholder="••••••" autocomplete="one-time-code">
        </div>

        <button type="submit" class="btn-submit">Подтвердить вход &rarr;</button>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; font-size: 12.5px;">
          <a href="/login" style="color: #64748b; text-decoration: none;">&larr; Назад к вводу пароля</a>
          <form action="/login" method="POST" style="display: inline;">
            <input type="hidden" name="login" value="admin">
            <input type="hidden" name="resend_otp" value="1">
            <button type="submit" style="background: none; border: none; color: #2563eb; cursor: pointer; text-decoration: underline; font-size: 12.5px;">Отправить код снова</button>
          </form>
        </div>
      `}

    <div class="security-badge">
      <span>🔒</span>
      <div>Все пароли, логины и учетные записи зашифрованы и хранятся в защищенной базе данных SQLite на вашем сервере.</div>
    </div>

    <div class="footer-note">
      ИП Климов Евгений Владимирович &bull; CRM v3.5
    </div>
  </div>

</body>
</html>`;
}
