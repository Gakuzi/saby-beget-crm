import fs from 'fs';
let code = fs.readFileSync('server.js', 'utf8');
code = code.replace(
  "app.use(express.json());",
  "app.use(express.json());\napp.use((req,res,next)=>{console.log('Proto:', req.protocol, 'Secure:', req.secure, 'Headers:', req.headers['x-forwarded-proto']); next();});"
);
fs.writeFileSync('server.js', code);
