import fs from 'fs';
let code = fs.readFileSync('src/server.js', 'utf8');

const regex = /app\.post\('\/add_client', \(req, res\) => \{([^]+?)req\.session\.flash = [^\n]+;\s+res\.redirect\([^)]+\);\s+\}\);/s;

code = code.replace(regex, (match) => {
  return match.replace(
    /app\.post\('\/add_client', \(req, res\) => \{/,
    "app.post('/add_client', (req, res) => { try {"
  ).replace(
    /res\.redirect\(`\/client\/\$\{newClient\.id\}`\);\n\}\);/,
    "res.redirect(`/client/${newClient.id}`); } catch(err) { console.error('ADD_CLIENT_ERROR:', err); res.status(500).send(err.message); }\n});"
  );
});

fs.writeFileSync('src/server.js', code);
