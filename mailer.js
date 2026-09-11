import nodemailer from 'nodemailer';
import { settingsManager } from './settings_manager.js';

class MailerService {
  getTransporter(overrideConfig = null) {
    const raw = settingsManager.getRawSettings();
    const host = overrideConfig?.smtp_host || raw.smtp_host || process.env.SMTP_HOST || 'smtp.beget.com';
    const port = parseInt(overrideConfig?.smtp_port || raw.smtp_port || process.env.SMTP_PORT || 465, 10);
    const secure = overrideConfig?.smtp_secure !== undefined 
      ? overrideConfig.smtp_secure 
      : (port === 465);
    const user = overrideConfig?.smtp_user || raw.smtp_user || process.env.SMTP_USER || '';
    const pass = overrideConfig?.smtp_password || raw.smtp_password || process.env.SMTP_PASSWORD || '';

    if (!host || !user || !pass) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000
    });
  }

  getFromAddress(overrideConfig = null) {
    const raw = settingsManager.getRawSettings();
    const name = overrideConfig?.smtp_from_name || raw.smtp_from_name || process.env.SMTP_FROM_NAME || 'Евгений Климов | IT-сопровождение';
    const email = overrideConfig?.smtp_from_email || raw.smtp_from_email || raw.smtp_user || process.env.SMTP_FROM_EMAIL || 'info@e-klimov.ru';
    return `"${name}" <${email}>`;
  }

  // Verify SMTP server credentials and optionally send test mail
  async testConnection(testToEmail = null, customConfig = null) {
    const transporter = this.getTransporter(customConfig);
    if (!transporter) {
      return { 
        ok: false, 
        error: 'Не заполнены обязательные параметры SMTP (сервер, логин или пароль) в настройках.' 
      };
    }

    try {
      await transporter.verify();

      if (testToEmail) {
        const from = this.getFromAddress(customConfig);
        const info = await transporter.sendMail({
          from,
          to: testToEmail,
          subject: '✓ Проверка почтового шлюза CRM | Евгений Климов',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #0284c7; margin-top: 0;">✓ Почтовый шлюз CRM успешно подключен</h2>
              <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                Это тестовое сообщение подтверждает, что основная почта настроена верно. Информационные письма, одноразовые коды входа для контактных лиц и уведомления по заявкам будут отправляться с этого адреса.
              </p>
              <div style="background: #f8fafc; padding: 14px 18px; border-radius: 8px; border-left: 4px solid #0284c7; font-size: 13.5px; color: #475569; margin: 18px 0;">
                <strong>Отправитель:</strong> ${from}<br>
                <strong>Дата отправки:</strong> ${new Date().toLocaleString('ru-RU')}
              </div>
              <p style="font-size: 13px; color: #94a3b8; margin-bottom: 0;">Saby & Beget CRM — Евгений Климов</p>
            </div>
          `
        });
        return { ok: true, message: `Соединение с SMTP установлено, тестовое письмо отправлено на ${testToEmail}! (ID: ${info.messageId})` };
      }

      return { ok: true, message: 'Соединение с SMTP-сервером успешно проверено (Ready to send).' };
    } catch (err) {
      console.error('[Mailer] Ошибка проверки SMTP:', err.message);
      return { ok: false, error: err.message };
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

    const transporter = this.getTransporter();
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
        subject: `Код подтверждения ${code} для входа в Личный кабинет — ${companyName}`,
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
    const transporter = this.getTransporter();
    if (!transporter) {
      return { ok: false, error: 'Почтовый сервер не настроен в CRM.' };
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

  // Notify admin when a ticket is created by client contact
  async sendTicketNotificationToAdmin({ ticket, client, contact }) {
    const raw = settingsManager.getRawSettings();
    const adminEmail = raw.admin_notify_email || 'EKlimov84@gmail.com';
    const transporter = this.getTransporter();
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
