import { generateRegistrationOptions } from '@simplewebauthn/server';

async function test() {
  const options = await generateRegistrationOptions({
    rpName: 'Test RP',
    rpID: 'localhost',
    userID: new Uint8Array(Buffer.from(String('1'))),
    userName: 'test@test.com',
    userDisplayName: 'Test User'
  });
  console.log(JSON.stringify(options, null, 2));
}
test();
