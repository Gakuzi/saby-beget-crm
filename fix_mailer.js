import fs from 'fs';
let code = fs.readFileSync('mailer.js', 'utf8');

// Inject format-detection meta tag for apple and update formatting of the OTP blocks

// 1. sendAdminLoginOtp
code = code.replace(
  /subject: \`Код для входа в CRM: \$\{code\}\`,\n\s*html: \`\n\s*<div style="font-family: sans-serif; padding: 20px;">\n\s*<h2>Вход в CRM Администратора<\/h2>\n\s*<p>Ваш одноразовый код для входа:<\/p>\n\s*<h1 style="color: #2563eb; letter-spacing: 5px;">\$\{code\}<\/h1>\n\s*<p>Код действителен в течение 10 минут\.<\/p>\n\s*<\/div>\n\s*\`/,
  \`subject: \\\`Код для входа в CRM: \${code}\\\`,
        html: \\\`
          <!DOCTYPE html>
          <html lang="ru">
          <head>
            <meta charset="utf-8">
            <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
          </head>
          <body>
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #1e293b;">
              <h2>Вход в CRM Администратора</h2>
              <p>Ваш код подтверждения для входа:</p>
              <div style="margin: 24px 0; padding: 16px; background-color: #f1f5f9; border-radius: 8px; display: inline-block;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">\${code}</span>
              </div>
              <p>Код действителен в течение 10 минут.</p>
            </div>
          </body>
          </html>
        \\\`\`
);

// 2. sendLoginVerificationCode
const portalOTPPattern = /subject: \`Код подтверждения \$\{code\} для входа в Личный кабинет — \$\{companyName\}\`,([\s\S]*?)<div style="text-align: center; margin: 30px 0;">\n\s*<div style="display: inline-block; background: #f8fafc; border: 2px dashed #cbd5e1; padding: 16px 36px; border-radius: 8px;">\n\s*<span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #1e40af;">\$\{code\}<\/span>\n\s*<\/div>\n\s*<\/div>/;

code = code.replace(
  portalOTPPattern,
  \`subject: \\\`Код авторизации: \${code} — Личный кабинет \${companyName}\\\`,
        html: \\\`
          <!DOCTYPE html>
          <html lang="ru">
          <head>
            <meta charset="utf-8">
            <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
          </head>
          <body>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
              <span style="font-size: 24px;">🔐</span>
              <div>
                <h3 style="margin: 0; font-size: 17px; color: #0f172a;">Клиентский портал технического сопровождения</h3>
                <div style="font-size: 13px; color: #64748b;">Евгений Климов | Сопровождение сайтов и серверов</div>
              </div>
            </div>

            <p style="font-size: 15px; line-height: 1.5; color: #334155; margin-top: 0;">
              Здравствуйте, <strong>\${contactName || 'Уважаемый партнер'}</strong>!
            </p>
            <p style="font-size: 14.5px; line-height: 1.5; color: #334155;">
              Запрошен вход в закрытый личный кабинет компании <strong>«\${companyName}»</strong>. Ваш код подтверждения для входа:
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background: #f8fafc; border: 2px dashed #cbd5e1; padding: 16px 36px; border-radius: 8px;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #1e40af;">\${code}</span>
              </div>
            </div>\`
);

fs.writeFileSync('mailer.js', code);
