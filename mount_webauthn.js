import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /import \{ generatePhpBackupAgent, generateBashInstaller \} from '\.\/backup_agent_generator\.js';/,
  "import { generatePhpBackupAgent, generateBashInstaller } from './backup_agent_generator.js';\nimport { setupWebAuthn } from './webauthn_routes.js';"
);

code = code.replace(
  /const app = express\(\);/,
  "const app = express();\nsetupWebAuthn(app);"
);

fs.writeFileSync('server.js', code);
