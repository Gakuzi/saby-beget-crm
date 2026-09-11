import { settingsManager } from './settings_manager.js';

let nodemailerInstance = null;
async function getNodemailer() {
  if (!nodemailerInstance) {
    try {
      const mod = await import('nodemailer');
      nodemailerInstance = mod.default || mod;
    } catch (err) {
      console.warn('[Mailer] nodemailer is not installed or failed to load:', err.message);
      return null;
    }
  }
  return nodemailerInstance;
}

class MailerService {
  // Send OTP for Admin login
  async sendAdminLoginOtp(email, code) {
    const transporter = await this.getTransporter();
    if (!transporter) return { ok: false, error: 'Почтовый транспорт не настроен' };
    try {
      const from = this.getFromAddress();
      await transporter.sendMail({
        from,
        to: email,
        subject: `${code} is your verification code`,
        html: `
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
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">${code}</span>
              </div>
              <p>Код действителен в течение 10 минут.</p>
            </div>
          </body>
          </html>
        `
      });
      return { ok: true };
    } catch (err) {
      console.error('[Mailer] Ошибка отправки OTP:', err.message);
      return { ok: false, error: err.message };
    }
  }

  async getTransporter(overrideConfig = null) {
    const nm = await getNodemailer();
    if (!nm) return null;

    const raw = settingsManager.getRawSettings();
    const host = (overrideConfig?.smtp_host || raw.smtp_host || process.env.SMTP_HOST || 'smtp.beget.com').trim();
    const port = parseInt(overrideConfig?.smtp_port || raw.smtp_port || process.env.SMTP_PORT || 465, 10);
    
    // In overrideConfig or raw settings: explicit secure flag or default by port (465 = SSL, 587/25 = STARTTLS)
    let secure = port === 465;
    if (overrideConfig?.smtp_secure !== undefined && overrideConfig?.smtp_secure !== '') {
      secure = overrideConfig.smtp_secure === true || overrideConfig.smtp_secure === 'true' || overrideConfig.smtp_secure === 1;
    } else if (raw.smtp_secure !== undefined) {
      secure = !!raw.smtp_secure;
    }

    const user = (overrideConfig?.smtp_user || raw.smtp_user || process.env.SMTP_USER || '').trim();

    // CRITICAL FIX: If overrideConfig sends empty or masked password (e.g. •••••••• or ***), fall back to saved password
    const isMaskedSecret = (v) => !v || typeof v !== 'string' || v.includes('•') || v.includes('●') || v.includes('***') || v.includes('…');
    let pass = overrideConfig?.smtp_password;
    if (isMaskedSecret(pass)) {
      pass = raw.smtp_password || process.env.SMTP_PASSWORD || '';
    } else {
      pass = String(pass).trim();
    }

    if (!host || !user || !pass) {
      return null;
    }

    return nm.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });
  }

  getFromAddress(overrideConfig = null) {
    const raw = settingsManager.getRawSettings();
    const user = (overrideConfig?.smtp_user || raw.smtp_user || process.env.SMTP_USER || 'noreply@e-klimov.ru').trim();
    const name = (overrideConfig?.smtp_from_name || raw.smtp_from_name || process.env.SMTP_FROM_NAME || 'Евгений Климов | IT-сопровождение').trim();
    
    // For Beget and many hosting providers, from email MUST match the auth mailbox user unless specific alias is permitted
    const isMasked = (v) => !v || typeof v !== 'string' || v.includes('•') || v.includes('●') || v.includes('***') || v.includes('…');
    let email = (overrideConfig?.smtp_from_email || raw.smtp_from_email || '').trim();
    if (isMasked(email) || !email || email.includes('info@e-klimov.ru')) {
      email = user;
    }
    return `"${name}" <${email}>`;
  }

  // Verify SMTP server credentials and optionally send test mail
  async testConnection(testToEmail = null, customConfig = null) {
    const raw = settingsManager.getRawSettings();
    const isMasked = (v) => !v || typeof v !== 'string' || v.includes('•') || v.includes('●') || v.includes('***') || v.includes('…');

    const host = (customConfig?.smtp_host || raw.smtp_host || 'smtp.beget.com').trim();
    const port = parseInt(customConfig?.smtp_port || raw.smtp_port || 465, 10);
    const user = (customConfig?.smtp_user || raw.smtp_user || '').trim();
    let pass = customConfig?.smtp_password;
    if (isMasked(pass)) {
      pass = raw.smtp_password || '';
    }

    if (!host || !user || !pass) {
      return { 
        ok: false, 
        error: 'Не заполнены обязательные параметры SMTP (сервер, логин или пароль) в настройках.',
        hint: 'Укажите хост сервера (например, smtp.beget.com), адрес почты и действующий пароль.'
      };
    }

    const transporter = await this.getTransporter({
      ...customConfig,
      smtp_host: host,
      smtp_port: port,
      smtp_user: user,
      smtp_password: pass
    });

    try {
      // Step 1: Verify SMTP handshake and authentication
      await transporter.verify();

      const targetEmail = (testToEmail || raw.admin_notify_email || user).trim();
      if (targetEmail) {
        const from = this.getFromAddress(customConfig);
        const info = await transporter.sendMail({
          from,
          to: targetEmail,
          subject: '✓ Проверка почтового шлюза CRM | Евгений Климов',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #0284c7; margin-top: 0;">✓ Почтовый шлюз CRM успешно подключен</h2>
              <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                Это тестовое сообщение подтверждает, что почтовый шлюз настроен корректно. Информационные письма, одноразовые 2FA-коды входа для контактных лиц и системные уведомления отправляются с этого адреса.
              </p>
              <div style="background: #f8fafc; padding: 14px 18px; border-radius: 8px; border-left: 4px solid #0284c7; font-size: 13.5px; color: #475569; margin: 18px 0;">
                <strong>SMTP Сервер:</strong> ${host}:${port}<br>
                <strong>Авторизованный ящик:</strong> ${user}<br>
                <strong>Отправитель (From):</strong> ${from}<br>
                <strong>Получатель:</strong> ${targetEmail}<br>
                <strong>Дата отправки:</strong> ${new Date().toLocaleString('ru-RU')}
              </div>
              <p style="font-size: 13px; color: #94a3b8; margin-bottom: 0;">Saby & Beget CRM — Евгений Климов</p>
            </div>
          `
        });
        return { 
          ok: true, 
          message: `Соединение с SMTP установлено, проверочное письмо успешно отправлено на ${targetEmail}! (MessageId: ${info.messageId})` 
        };
      }

      return { ok: true, message: `Соединение с SMTP-сервером ${host}:${port} успешно проверено (Аутентификация пройдена).` };
    } catch (err) {
      console.error('[Mailer] Ошибка проверки SMTP:', err);
      let hint = 'Проверьте реквизиты почты.';
      const msg = err.message || '';

      if (msg.includes('Invalid login') || msg.includes('535') || err.code === 'EAUTH') {
        hint = `Сервер ${host} отклонил логин или пароль для ящика ${user}. ` +
          `Проверьте: 1) Пароль почтового ящика задается в панели Beget («Почта» -> ${user}), он отличается от пароля от аккаунта хостинга. ` +
          `2) В CRM уже сохранен проверенный рабочий пароль: оставьте поле пароля пустым при сохранении, чтобы использовать его.`;
      } else if (msg.includes('Sender address rejected') || msg.includes('553') || msg.includes('does not exists') || msg.includes('only local domains')) {
        hint = `Хостинг Beget требует, чтобы адрес отправителя (From) строго совпадал с ящиком авторизации (${user}) и реально существовал на хостинге.`;
      } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
        hint = `Таймаут или сброс соединения к ${host}:${port}. Попробуйте сменить порт на 465 (SSL) или 587 (STARTTLS).`;
      } else if (err.code === 'ESOCKET' || msg.includes('greeting')) {
        hint = `Ошибка протокола TLS/SSL. Для порта 465 используйте SSL=Вкл, для 587 или 25 — SSL=Выкл.`;
      }

      return { 
        ok: false, 
        error: `${err.message} (${err.code || 'SMTP_ERR'})`,
        hint
      };
    }
  }

  // Send 6-digit confirmation code for portal login
  async sendLoginVerificationCode({ toEmail, contactName, companyName, code, directLink }) {
    console.log(`\n======================================================`);
    console.log(`[PORTAL 2FA CODE] Для: ${contactName} <${toEmail}>`);
    console.log(`[PORTAL 2FA CODE] Компания: ${companyName}`);
    console.log(`[PORTAL 2FA CODE] ОДНОРАЗОВЫЙ КОД: >>> ${code} <<<`);
    if (directLink) console.log(`[PORTAL 2FA CODE] Прямая ссылка: ${directLink}`);
    console.log(`======================================================\n`);

    const transporter = await this.getTransporter();
    if (!transporter) {
      return {
        ok: true,
        simulated: true,
        code,
        message: 'SMTP-сервер пока не настроен в CRM. Одноразовый код зафиксирован в журнале сервера и доступен для входа.'
      };
    }

    try {
      const from = this.getFromAddress();
      await transporter.sendMail({
        from,
        to: toEmail,
        subject: `${code} is your verification code`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
              <span style="font-size: 24px;">🔐</span>
              <div>
                <h3 style="margin: 0; font-size: 17px; color: #0f172a;">Клиентский портал технического сопровождения</h3>
                <div style="font-size: 13px; color: #64748b;">Евгений Климов | Сопровождение сайтов и серверов</div>
              </div>
            </div>

            <p style="font-size: 15px; line-height: 1.5; color: #334155; margin-top: 0;">
              Здравствуйте, <strong>${contactName || 'Уважаемый партнер'}</strong>!
            </p>
            <p style="font-size: 14.5px; line-height: 1.5; color: #334155;">
              Запрошен вход в закрытый личный кабинет компании <strong>«${companyName}»</strong>. Для подтверждения вашей личности введите одноразовый код:
            </p>

            <!-- Verification Code Highlight Block -->
            <div style="text-align: center; margin: 26px 0;">
              <div style="display: inline-block; background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%); border: 2px solid #0284c7; border-radius: 12px; padding: 16px 36px;">
                <div style="font-size: 12px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Одноразовый код доступа</div>
                <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: monospace;">
                  ${code}
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Действителен в течение 15 минут</div>
              </div>
            </div>

            <div style="background: #f8fafc; border-radius: 8px; padding: 14px; font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 22px;">
              🛡️ <strong>Безопасность:</strong> Личный кабинет содержит договоры, финансовую информацию и управление инфраструктурой сайтов. Никогда не передавайте этот код третьим лицам.
            </div>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12.5px; color: #94a3b8; line-height: 1.5;">
              Если вы не запрашивали доступ в личный кабинет, просто проигнорируйте это письмо.<br>
              Служба технической поддержки: <a href="mailto:${from}" style="color: #0284c7; text-decoration: none;">${from}</a>
            </div>
          </div>
        `
      });

      return { ok: true, message: `Код подтверждения отправлен на почту ${toEmail}` };
    } catch (err) {
      console.error('[Mailer] Ошибка отправки кода подтверждения:', err.message);
      return { 
        ok: true, 
        simulated: true, 
        code, 
        error: `Не удалось отправить через SMTP (${err.message}). Код отображен в журнале сервера.` 
      };
    }
  }

  // Send onboarding invitation email with direct secret link
  async sendContactInvite({ toEmail, contactName, companyName, accessUrl }) {
    const transporter = await this.getTransporter();
    if (!transporter) {
      return { ok: false, error: 'Почтовый сервер не настроен в CRM или библиотека nodemailer отсутствует.' };
    }

    try {
      const from = this.getFromAddress();
      await transporter.sendMail({
        from,
        to: toEmail,
        subject: `Персональный доступ в Клиентский портал — ${companyName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
            <h3 style="margin-top: 0; color: #0f172a; font-size: 18px;">Персональный доступ в Клиентский портал</h3>
            <p style="font-size: 14.5px; line-height: 1.5; color: #334155;">
              Здравствуйте, <strong>${contactName}</strong>!<br>
              Для вас активирован персональный доступ в личный кабинет сопровождения компании <strong>«${companyName}»</strong>.
            </p>
            <p style="font-size: 14px; line-height: 1.5; color: #475569;">
              В портале вы сможете отслеживать состояние сайтов, статус резервных копий, баланс предоплаченных часов и подавать приоритетные технические заявки.
            </p>
            <div style="text-align: center; margin: 26px 0;">
              <a href="${accessUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);">
                Войти в Личный кабинет
              </a>
            </div>
            <div style="background: #eff6ff; border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #1e40af; line-height: 1.5;">
              🔒 <strong>Двухфакторная защита:</strong> При переходе по ссылке на вашу почту (${toEmail}) будет автоматически направлен 6-значный код подтверждения.
            </div>
          </div>
        `
      });
      return { ok: true, message: `Приглашение успешно отправлено на ${toEmail}` };
    } catch (err) {
      console.error('[Mailer] Ошибка отправки приглашения:', err.message);
      return { ok: false, error: err.message };
    }
  }

  // Send Admin 2FA verification code
  async sendAdminVerificationCode({ email, code }) {
    const transporter = await this.getTransporter();
    if (!transporter) {
      console.warn('[Mailer] Почтовый транспорт не настроен, 2FA код:', code);
      return { ok: false, error: 'Почтовый сервер не настроен' };
    }

    try {
      const from = this.getFromAddress();
      await transporter.sendMail({
        from,
        to: email,
        subject: `${code} is your verification code`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: auto; padding: 26px; border: 1px solid #cbd5e1; border-radius: 12px; background: #ffffff; color: #0f172a;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
              <span style="font-size: 24px;">🛡️</span>
              <h2 style="margin: 0; font-size: 19px; font-weight: 700; color: #0f172a;">Вход в CRM Администратора</h2>
            </div>
            <p style="font-size: 14.5px; line-height: 1.5; color: #334155;">
              Здравствуйте, Евгений! Выполнен вход в панель управления IT-инфраструктурой и договорами.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <div style="display: inline-block; background: #f1f5f9; border: 2px solid #6366f1; border-radius: 10px; padding: 16px 36px;">
                <div style="font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Код подтверждения</div>
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: monospace;">
                  ${code}
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Действителен 15 минут</div>
              </div>
            </div>
            <p style="font-size: 12.5px; color: #64748b; line-height: 1.4; border-top: 1px solid #f1f5f9; padding-top: 14px; margin-bottom: 0;">
              Если вы не запрашивали вход, немедленно измените пароль учетной записи.
            </p>
          </div>
        `
      });
      return { ok: true, message: `Код подтверждения отправлен на ${email}` };
    } catch (err) {
      console.error('[Mailer] Ошибка отправки кода администратора:', err.message);
      return { ok: false, error: err.message };
    }
  }

  // Send Invoice for payment
  async sendInvoiceNotification({ toEmail, client, invoiceNumber, amount, billingPeriod }) {
    const transporter = await this.getTransporter();
    if (!transporter) {
      return { ok: false, error: 'Почтовый транспорт не настроен' };
    }

    try {
      const from = this.getFromAddress();
      const num = invoiceNumber || `СЧ-${Math.floor(1000 + Math.random() * 9000)}`;
      const sumFormatted = new Intl.NumberFormat('ru-RU').format(amount || client.monthly_fee || 15000);
      const period = billingPeriod || new Date().toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

      await transporter.sendMail({
        from,
        to: toEmail,
        subject: `Счет на оплату № ${num} по договору ${client.saby_contract_number || ''} — ${client.company_name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
            <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 14px; margin-bottom: 20px;">
              <h3 style="margin: 0; color: #0f172a; font-size: 18px;">Счет на оплату услуг технической поддержки</h3>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Исполнитель: ИП Климов Евгений Владимирович (ИНН 500100732259)</div>
            </div>

            <p style="font-size: 14.5px; line-height: 1.5; color: #334155;">
              Уважаемые партнеры <strong>«${client.company_name}»</strong>!<br>
              Направляем счет на абонентское обслуживание по договору № <strong>${client.saby_contract_number || 'б/н'}</strong> за <strong>${period}</strong>.
            </p>

            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; margin: 20px 0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                <span>Номер счета:</span> <strong>№ ${num}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                <span>Период обслуживания:</span> <strong>${period}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
                <span>Договор:</span> <strong>${client.saby_contract_title || 'Договор технического сопровождения'}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 17px; font-weight: 800; color: #1e40af; border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 10px;">
                <span>Сумма к оплате:</span> <span>${sumFormatted} руб. (НДС не облагается)</span>
              </div>
            </div>

            <p style="font-size: 13.5px; line-height: 1.5; color: #475569;">
              Оригиналы расчетных документов (счет и акт) также направлены вам через систему электронного документооборота (СБИС / Диадок).
            </p>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
              С уважением,<br>
              <strong>ИП Климов Е.В.</strong><br>
              Тел: +7 (926) 880-99-90 | Email: EKlimov84@gmail.com
            </div>
          </div>
        `
      });

      return { ok: true, message: `Счет отправлен на ${toEmail}` };
    } catch (err) {
      console.error('[Mailer] Ошибка отправки счета:', err.message);
      return { ok: false, error: err.message };
    }
  }

  // Send Payment Reminder
  async sendPaymentReminder({ toEmail, client, contractNumber, amount }) {
    const transporter = await this.getTransporter();
    if (!transporter) return { ok: false, error: 'Почтовый транспорт не настроен' };

    try {
      const from = this.getFromAddress();
      const sumFormatted = new Intl.NumberFormat('ru-RU').format(amount || client.monthly_fee || 15000);

      await transporter.sendMail({
        from,
        to: toEmail,
        subject: `Напоминание об оплате по договору ${contractNumber || client.saby_contract_number || ''} — ${client.company_name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: auto; padding: 26px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
            <h3 style="margin-top: 0; color: #b45309; font-size: 18px;">Напоминание о проведении оплаты</h3>
            <p style="font-size: 14.5px; line-height: 1.5; color: #334155;">
              Здравствуйте! Напоминаем о необходимости оплаты услуг технического сопровождения веб-ресурсов по договору <strong>№ ${contractNumber || client.saby_contract_number || 'б/н'}</strong>.
            </p>
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; color: #92400e;">
              <strong>Сумма к перечислению:</strong> ${sumFormatted} руб.<br>
              <strong>Получатель:</strong> ИП Климов Евгений Владимирович (ИНН 500100732259)
            </div>
            <p style="font-size: 13.5px; color: #475569;">
              Если оплата уже произведена, пожалуйста, проигнорируйте данное сообщение или направьте платежное поручение в ответном письме.
            </p>
          </div>
        `
      });
      return { ok: true, message: `Напоминание успешно отправлено на ${toEmail}` };
    } catch (err) {
      console.error('[Mailer] Ошибка отправки напоминания:', err.message);
      return { ok: false, error: err.message };
    }
  }

  // Send Closing Act notification
  async sendActNotification({ toEmail, client, actNumber, monthName }) {
    const transporter = await this.getTransporter();
    if (!transporter) return { ok: false, error: 'Почтовый транспорт не настроен' };

    try {
      const from = this.getFromAddress();
      const period = monthName || new Date().toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

      await transporter.sendMail({
        from,
        to: toEmail,
        subject: `Акт выполненных работ ${actNumber || ''} за ${period} — ${client.company_name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: auto; padding: 26px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; color: #1e293b;">
            <h3 style="margin-top: 0; color: #047857; font-size: 18px;">Сформирован Акт выполненных работ</h3>
            <p style="font-size: 14.5px; line-height: 1.5; color: #334155;">
              Уважаемые партнеры <strong>«${client.company_name}»</strong>!<br>
              Регламентные работы по сопровождению ваших веб-сайтов и серверов за <strong>${period}</strong> успешно завершены.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; color: #166534;">
              📄 Акт <strong>№ ${actNumber || 'АКТ-01'}</strong> подписан с нашей стороны электронной подписью и передан в систему ЭДО <strong>СБИС</strong>.
            </div>
            <p style="font-size: 13.5px; color: #475569;">
              Пожалуйста, подпишите акт со своей стороны в системе электронного документооборота.
            </p>
          </div>
        `
      });
      return { ok: true, message: `Уведомление об акте отправлено на ${toEmail}` };
    } catch (err) {
      console.error('[Mailer] Ошибка отправки акта:', err.message);
      return { ok: false, error: err.message };
    }
  }

  // Notify admin when a ticket is created by client contact
  async sendTicketNotificationToAdmin({ ticket, client, contact }) {
    const raw = settingsManager.getRawSettings();
    const adminEmail = raw.admin_notify_email || 'EKlimov84@gmail.com';
    const transporter = await this.getTransporter();
    if (!transporter) return;

    try {
      const from = this.getFromAddress();
      await transporter.sendMail({
        from,
        to: adminEmail,
        subject: `[CRM Заявка #${ticket.id}] ${client.company_name} — ${ticket.subject}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
            <h3 style="margin-top: 0; color: #dc2626;">Новая заявка из клиентского портала</h3>
            <p><strong>Клиент:</strong> ${client.company_name} (ИНН: ${client.inn})</p>
            <p><strong>Контактное лицо:</strong> ${contact ? `${contact.name} (${contact.position || 'Контакт'}), ${contact.email}` : 'Клиент'}</p>
            <p><strong>Тема:</strong> ${ticket.subject}</p>
            <p><strong>Категория:</strong> ${ticket.service || 'Общие вопросы'}</p>
            <p><strong>Приоритет:</strong> ${ticket.priority || 'Обычный'}</p>
            <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-top: 14px;">
              <strong>Описание:</strong><br>${(ticket.message || '').replace(/\n/g, '<br>')}
            </div>
            <p style="margin-top: 20px;">
              <a href="https://test.crm.e-klimov.ru/client/${client.id}?tab=works" style="color: #2563eb; font-weight: bold;">Открыть карточку клиента в CRM &rarr;</a>
            </p>
          </div>
        `
      });
    } catch (e) {
      console.warn('[Mailer] Не удалось отправить уведомление о тикете админу:', e.message);
    }
  }
}

export const mailer = new MailerService();
