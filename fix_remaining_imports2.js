import fs from 'fs';

function replaceInFile(file, replacements) {
    if (!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    for (const [search, replace] of replacements) {
        code = code.split(search).join(replace);
    }
    fs.writeFileSync(file, code);
}

replaceInFile('src/views/portal_view.js', [
    ["from './crm_store.js'", "from '../db/crm_store.js'"]
]);

replaceInFile('src/views/admin_login_view.js', [
    ["from './sqlite_db.js'", "from '../db/sqlite_db.js'"]
]);

replaceInFile('src/views/dossier_view.js', [
    ["from './crm_store.js'", "from '../db/crm_store.js'"]
]);

replaceInFile('src/services/ssh_service.js', [
    ["from './crm_store.js'", "from '../db/crm_store.js'"]
]);

replaceInFile('src/utils/backup_agent_generator.js', [
    ["from './settings_manager.js'", "from '../config/settings_manager.js'"]
]);

