import fs from 'fs';
import path from 'path';

function replaceInFile(file, replacements) {
    if (!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    for (const [search, replace] of replacements) {
        code = code.split(search).join(replace);
    }
    fs.writeFileSync(file, code);
}

// Fix server.js
replaceInFile('src/server.js', [
    ["from './sqlite_db.js'", "from './db/sqlite_db.js'"],
    ["from './admin_view.js'", "from './views/admin_view.js'"],
    ["from './webauthn_routes.js'", "from './api/webauthn_routes.js'"],
    ["from './inn_helper.js'", "from './utils/inn_helper.js'"],
    ["from './github_sync.js'", "from './services/github_sync.js'"],
    ["from './saby_client.js'", "from './services/saby_client.js'"],
    ["from './beget_client.js'", "from './services/beget_client.js'"],
    ["from './mailer.js'", "from './services/mailer.js'"],
    ["from './settings_manager.js'", "from './config/settings_manager.js'"],
    ["from './crm_store.js'", "from './db/crm_store.js'"],
    ["path.join(__dirname, 'data')", "path.join(__dirname, '../data')"] // server.js is now in src/
]);

// Fix webauthn_routes.js
replaceInFile('src/api/webauthn_routes.js', [
    ["from './crm_store.js'", "from '../db/crm_store.js'"],
    ["from './sqlite_db.js'", "from '../db/sqlite_db.js'"]
]);

// Fix admin_view.js
replaceInFile('src/views/admin_view.js', [
    ["from './crm_store.js'", "from '../db/crm_store.js'"],
    ["from './sqlite_db.js'", "from '../db/sqlite_db.js'"]
]);

// Fix sqlite_db.js
replaceInFile('src/db/sqlite_db.js', [
    ["from './crm_store.js'", "from './crm_store.js'"],
    ["path.join(__dirname, 'data')", "path.join(__dirname, '../../data')"] // sqlite_db is in src/db/
]);

// Fix inn_helper.js
replaceInFile('src/utils/inn_helper.js', [
    ["from './crm_store.js'", "from '../db/crm_store.js'"],
    ["from './sqlite_db.js'", "from '../db/sqlite_db.js'"],
    ["import('./saby_client.js')", "import('../services/saby_client.js')"]
]);

// Fix saby_client.js
replaceInFile('src/services/saby_client.js', [
    ["from './crm_store.js'", "from '../db/crm_store.js'"],
    ["from './sqlite_db.js'", "from '../db/sqlite_db.js'"],
    ["from './settings_manager.js'", "from '../config/settings_manager.js'"]
]);

// Fix beget_client.js
replaceInFile('src/services/beget_client.js', [
    ["from './crm_store.js'", "from '../db/crm_store.js'"],
    ["from './settings_manager.js'", "from '../config/settings_manager.js'"]
]);

// Fix github_sync.js
replaceInFile('src/services/github_sync.js', [
    ["from './settings_manager.js'", "from '../config/settings_manager.js'"]
]);

// Fix mailer.js
replaceInFile('src/services/mailer.js', [
    ["from './settings_manager.js'", "from '../config/settings_manager.js'"]
]);

// Fix crm_store.js
replaceInFile('src/db/crm_store.js', [
    ["from './sqlite_db.js'", "from './sqlite_db.js'"]
]);

// We also need to add static serving for public directory in server.js
let serverCode = fs.readFileSync('src/server.js', 'utf8');
if (!serverCode.includes("express.static('public')")) {
    serverCode = serverCode.replace("app.use(express.urlencoded({ extended: true }));", "app.use(express.urlencoded({ extended: true }));\napp.use(express.static(path.join(__dirname, '../public')));");
    fs.writeFileSync('src/server.js', serverCode);
}

