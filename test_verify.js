import { verifyAuthenticationResponse } from '@simplewebauthn/server';
console.log(verifyAuthenticationResponse.toString().includes('Uint8Array'));
