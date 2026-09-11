import fs from 'fs';

let code = fs.readFileSync('src/server.js', 'utf8');

code = code.replace("from './admin_login_view.js'", "from './views/admin_login_view.js'");
code = code.replace("from './portal_view.js'", "from './views/portal_view.js'");
code = code.replace("from './dossier_view.js'", "from './views/dossier_view.js'");
code = code.replace("from './ssh_service.js'", "from './services/ssh_service.js'");
code = code.replace("from './backup_agent_generator.js'", "from './utils/backup_agent_generator.js'");
// Let's also check if I missed any.
fs.writeFileSync('src/server.js', code);
