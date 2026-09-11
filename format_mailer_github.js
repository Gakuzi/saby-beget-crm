import fs from 'fs';
let code = fs.readFileSync('mailer.js', 'utf8');

// The secret to iOS/Mac parsing is having the text *exactly* matching a known format or structure.
// GitHub uses: "Here is your GitHub sudo authentication code: 35661491" or similar short, unformatted text
// in addition to the HTML structure.
// Let's modify the OTP template to mimic this structure explicitly to trigger the OS detectors.

const adminOTPOld = "              <p>Ваш код подтверждения для входа:</p>\\n" +
  "              <div style=\"margin: 24px 0; padding: 16px; background-color: #f1f5f9; border-radius: 8px; display: inline-block;\">\\n" +
  "                <span style=\"font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;\">\\${code}</span>\\n" +
  "              </div>";

const adminOTPNew = "              <p>Here is your authentication code:</p>\\n" +
  "              <div style=\"margin: 24px 0; padding: 16px; background-color: #f1f5f9; border-radius: 8px; display: inline-block;\">\\n" +
  "                <span style=\"font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;\">\\${code}</span>\\n" +
  "              </div>\\n" +
  "              <div style=\"display:none; color:transparent;\">Here is your authentication code: \\${code}</div>";

code = code.replace(adminOTPOld, adminOTPNew);

const clientOTPOld = "              Запрошен вход в закрытый личный кабинет компании <strong>«\\${companyName}»</strong>. Ваш код подтверждения для входа:\\n" +
  "            </p>\\n\\n" +
  "            <div style=\"text-align: center; margin: 30px 0;\">\\n" +
  "              <div style=\"display: inline-block; background: #f8fafc; border: 2px dashed #cbd5e1; padding: 16px 36px; border-radius: 8px;\">\\n" +
  "                <span style=\"font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #1e40af;\">\\${code}</span>\\n" +
  "              </div>\\n" +
  "            </div>";

const clientOTPNew = "              Запрошен вход в закрытый личный кабинет компании <strong>«\\${companyName}»</strong>. Here is your authentication code:\\n" +
  "            </p>\\n\\n" +
  "            <div style=\"text-align: center; margin: 30px 0;\">\\n" +
  "              <div style=\"display: inline-block; background: #f8fafc; border: 2px dashed #cbd5e1; padding: 16px 36px; border-radius: 8px;\">\\n" +
  "                <span style=\"font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #1e40af;\">\\${code}</span>\\n" +
  "              </div>\\n" +
  "            </div>\\n" +
  "            <div style=\"display:none; color:transparent;\">Here is your authentication code: \\${code}</div>";

code = code.replace(clientOTPOld, clientOTPNew);

// In case the exact matching fails, try simpler English trigger sentence (it works universally on all OS languages)
fs.writeFileSync('mailer.js', code);
