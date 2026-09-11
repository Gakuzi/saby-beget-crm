import { generateRegistrationOptions } from '@simplewebauthn/server';

async function test() {
  try {
    const options = await generateRegistrationOptions({
      rpName: 'Test RP',
      rpID: 'localhost',
      userID: '1',
      userName: 'test@test.com',
      userDisplayName: 'Test User'
    });
    console.log('Success:', !!options);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
