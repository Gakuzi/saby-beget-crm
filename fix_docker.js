import fs from 'fs';
if (fs.existsSync('deploy/Dockerfile')) {
    let dockerfile = fs.readFileSync('deploy/Dockerfile', 'utf8');
    dockerfile = dockerfile.replace('CMD ["node", "server.js"]', 'CMD ["node", "src/server.js"]');
    fs.writeFileSync('deploy/Dockerfile', dockerfile);
}
if (fs.existsSync('deploy/install.sh')) {
    let install = fs.readFileSync('deploy/install.sh', 'utf8');
    install = install.replace('node server.js"', 'node src/server.js"');
    fs.writeFileSync('deploy/install.sh', install);
}
