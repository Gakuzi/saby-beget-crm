import fs from 'fs';
let code = fs.readFileSync('mailer.js', 'utf8');

const newMethod = `
  // Send OTP for Admin login
  async sendAdminLoginOtp(email, code) {
    const transporter = await this.getTransporter();
    if (!transporter) return { ok: false, error: 'Почтовый транспорт не настроен' };
    try {
      const from = this.getFromAddress();
      await transporter.sendMail({
        from,
        to: email,
        subject: \`Код для входа в CRM: \${code}\`,
        html: \`
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Вход в CRM Администратора</h2>
            <p>Ваш одноразовый код для входа:</p>
            <h1 style="color: #2563eb; letter-spacing: 5px;">\${code}</h1>
            <p>Код действителен в течение 10 минут.</p>
          </div>
        \`
      });
      return { ok: true };
    } catch (err) {
      console.error('[Mailer] Ошибка отправки OTP:', err.message);
      return { ok: false, error: err.message };
    }
  }
`;

code = code.replace(/class MailerService \{/, 'class MailerService {' + newMethod);

fs.writeFileSync('mailer.js', code);
