import fs from 'fs';
let code = fs.readFileSync('mailer.js', 'utf8');

// 1. sendAdminLoginOtp
code = code.replace(
  /subject: \`Код для входа в CRM: \$\{code\}\`,\n\s*html: \`\n\s*<div style="font-family: sans-serif; padding: 20px;">\n\s*<h2>Вход в CRM Администратора<\/h2>\n\s*<p>Ваш одноразовый код для входа:<\/p>\n\s*<h1 style="color: #2563eb; letter-spacing: 5px;">\$\{code\}<\/h1>\n\s*<p>Код действителен в течение 10 минут\.<\/p>\n\s*<\/div>\n\s*\`/,
  "subject: `Код авторизации: ${code} - CRM Администратора`,\n" +
  "        html: `\n" +
  "          <!DOCTYPE html>\n" +
  "          <html lang=\"ru\">\n" +
  "          <head>\n" +
  "            <meta charset=\"utf-8\">\n" +
  "            <meta name=\"format-detection\" content=\"telephone=no, date=no, address=no, email=no\">\n" +
  "          </head>\n" +
  "          <body>\n" +
  "            <div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #1e293b;\">\n" +
  "              <h2>Вход в CRM Администратора</h2>\n" +
  "              <p>Ваш код подтверждения для входа:</p>\n" +
  "              <div style=\"margin: 24px 0; padding: 16px; background-color: #f1f5f9; border-radius: 8px; display: inline-block;\">\n" +
  "                <span style=\"font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;\">${code}</span>\n" +
  "              </div>\n" +
  "              <p>Код действителен в течение 10 минут.</p>\n" +
  "            </div>\n" +
  "          </body>\n" +
  "          </html>\n" +
  "        `"
);

// 2. sendLoginVerificationCode
const portalOTPPattern = /subject: \`Код подтверждения \$\{code\} для входа в Личный кабинет — \$\{companyName\}\`,([\s\S]*?)<div style="text-align: center; margin: 30px 0;">\n\s*<div style="display: inline-block; background: #f8fafc; border: 2px dashed #cbd5e1; padding: 16px 36px; border-radius: 8px;">\n\s*<span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #1e40af;">\$\{code\}<\/span>\n\s*<\/div>\n\s*<\/div>/;

code = code.replace(
  portalOTPPattern,
  "subject: `Код авторизации: ${code} — Личный кабинет ${companyName}`,\n" +
  "        html: `\n" +
  "          <!DOCTYPE html>\n" +
  "          <html lang=\"ru\">\n" +
  "          <head>\n" +
  "            <meta charset=\"utf-8\">\n" +
  "            <meta name=\"format-detection\" content=\"telephone=no, date=no, address=no, email=no\">\n" +
  "          </head>\n" +
  "          <body>\n" +
  "          <div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;\">\n" +
  "            <div style=\"display: flex; align-items: center; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;\">\n" +
  "              <span style=\"font-size: 24px;\">🔐</span>\n" +
  "              <div>\n" +
  "                <h3 style=\"margin: 0; font-size: 17px; color: #0f172a;\">Клиентский портал технического сопровождения</h3>\n" +
  "                <div style=\"font-size: 13px; color: #64748b;\">Евгений Климов | Сопровождение сайтов и серверов</div>\n" +
  "              </div>\n" +
  "            </div>\n" +
  "\n" +
  "            <p style=\"font-size: 15px; line-height: 1.5; color: #334155; margin-top: 0;\">\n" +
  "              Здравствуйте, <strong>${contactName || 'Уважаемый партнер'}</strong>!\n" +
  "            </p>\n" +
  "            <p style=\"font-size: 14.5px; line-height: 1.5; color: #334155;\">\n" +
  "              Запрошен вход в закрытый личный кабинет компании <strong>«${companyName}»</strong>. Ваш код подтверждения для входа:\n" +
  "            </p>\n" +
  "\n" +
  "            <div style=\"text-align: center; margin: 30px 0;\">\n" +
  "              <div style=\"display: inline-block; background: #f8fafc; border: 2px dashed #cbd5e1; padding: 16px 36px; border-radius: 8px;\">\n" +
  "                <span style=\"font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #1e40af;\">${code}</span>\n" +
  "              </div>\n" +
  "            </div>`"
);

fs.writeFileSync('mailer.js', code);
