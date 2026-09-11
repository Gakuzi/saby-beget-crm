import fetch from 'node-fetch';

async function test() {
  // We need to bypass or mock the OTP to test it directly.
  // Instead, let's just make a POST to /login with wrong credentials.
  const r = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'login=admin&password=123&next=/'
  });
  console.log(r.status, await r.text());
}
test();
