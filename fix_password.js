import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');

const changePasswordView = `app.get('/change-password', (req, res) => {`;
const changePasswordEnd = `</html>\`);\n});`;

// We need to modify change-password view and post to allow changing if no current password is set or if logged in.
