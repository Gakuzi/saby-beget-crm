import express from 'express';
const app = express();
app.use(express.urlencoded({ extended: true }));
app.post('/test', (req, res) => {
  console.log(req.body);
  res.send('ok');
  server.close();
});
const server = app.listen(3001, () => {
  fetch('http://localhost:3001/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'contact_names[]=Иван&contact_names[]=Петр&sites[]=test.com'
  });
});
