import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { db } from './crm_store.js';

// The Relying Party (RP) ID and Name
const rpName = 'Saby Beget CRM';
// Get dynamic RP ID from request host in production, or localhost for dev.
const getRpId = (req) => {
  if (req.hostname === 'localhost' || req.hostname === '0.0.0.0') return req.hostname;
  return req.hostname; 
};

export function setupWebAuthn(app) {
  app.get('/webauthn/generate-auth', async (req, res) => {
    try {
      // In a real app we might ask for email first, but for simplicity we can allow passkey discoverable credentials (usernameless login)
      const options = await generateAuthenticationOptions({
        rpID: getRpId(req),
        userVerification: 'preferred',
      });
      // Save challenge to session for verification
      if (!req.session) { console.error('SESSION IS UNDEFINED IN generate-auth!'); res.status(500).json({error: 'Session not initialized'}); return; }
      if (!req.session) { console.error('SESSION IS UNDEFINED IN generate-reg!'); res.status(500).json({error: 'Session not initialized'}); return; }
      if (!req.session) { console.error('SESSION IS UNDEFINED!'); return res.status(500).json({error: 'Session not initialized'}); }
      req.session.currentChallenge = options.challenge;
      req.session.save();
      res.json(options);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/webauthn/verify-auth', async (req, res) => {
    try {
      const response = req.body;
      const expectedChallenge = req.session.currentChallenge;
      
      if (!expectedChallenge) {
        return res.status(400).json({ error: 'Сессия устарела. Попробуйте еще раз.' });
      }

      // Find the passkey in DB
      // normalize id just in case
      let passkey = db.getPasskey(response.id);
      if (!passkey) {
        // Try looking up by device if we can't find by ID
        const allPasskeys = db.db.prepare('SELECT * FROM admin_passkeys').all();
        passkey = allPasskeys.find(p => p.id === response.id || Buffer.from(p.id, 'base64').toString('base64url') === response.id || p.id === Buffer.from(response.id, 'base64url').toString('base64'));
      }
      if (!passkey) {
        return res.status(400).json({ error: 'Ключ не найден в базе данных' });
      }
      
      const adminData = db.db.prepare('SELECT id, username, email FROM admin_users WHERE id = ?').get(passkey.admin_id);
      if (!adminData) {
        return res.status(400).json({ error: 'Пользователь не найден' });
      }

      const expectedOrigin = req.protocol + '://' + req.get('host');

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: getRpId(req),
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(Buffer.from(passkey.public_key, 'base64')),
          counter: passkey.counter,
          transports: passkey.transports ? passkey.transports.split(',') : undefined,
        },
      });

      if (verification.verified) {
        // Update counter
        db.updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);
        
        req.session.admin_id = adminData.id;
        req.session.crm_admin_user = adminData.username || adminData.email;
        db.setAdminLastLogin(adminData.id);
        req.session.currentChallenge = undefined;
        
        req.session.save(() => {
          res.json({ verified: true });
        });
      } else {
        res.status(400).json({ verified: false, error: 'Проверка не пройдена' });
      }
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: e.message });
    }
  });

  // Registration endpoints (Requires active admin session)
  app.get('/webauthn/generate-reg', async (req, res) => {
    if (!req.session.admin_id) return res.status(401).json({ error: 'Не авторизован' });
    
    try {
      console.log('Generating reg options for admin:', req.session.admin_id);
      const admin = db.db.prepare('SELECT id, username, email FROM admin_users WHERE id = ?').get(req.session.admin_id);
      console.log('Admin found:', admin);
      
      const userPasskeys = db.getAdminPasskeys(admin.id);
      
      const options = await generateRegistrationOptions({
        rpName,
        rpID: getRpId(req),
        userID: new Uint8Array(Buffer.from(String(admin.id))), // must be a Uint8Array
        userName: admin.email,
        userDisplayName: admin.username || admin.email,
        attestationType: 'none',
        excludeCredentials: userPasskeys.map(pk => ({
          id: pk.id,
          type: 'public-key',
          transports: pk.transports ? pk.transports.split(',') : undefined,
        })),
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'preferred',
        },
      });
      
      if (!req.session) { console.error('SESSION IS UNDEFINED!'); return res.status(500).json({error: 'Session not initialized'}); }
      req.session.currentChallenge = options.challenge;
      req.session.save();
      res.json(options);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/webauthn/verify-reg', async (req, res) => {
    if (!req.session.admin_id) return res.status(401).json({ error: 'Не авторизован' });
    
    try {
      const response = req.body;
      const expectedChallenge = req.session.currentChallenge;
      
      if (!expectedChallenge) {
        return res.status(400).json({ error: 'Сессия устарела. Попробуйте еще раз.' });
      }
      
      const expectedOrigin = req.protocol + '://' + req.get('host');
      
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: getRpId(req),
      });

      if (verification.verified && verification.registrationInfo) {
        const { credentialDeviceType, credentialBackedUp, credential } = verification.registrationInfo;
        const credentialPublicKey = credential ? credential.publicKey : (verification.registrationInfo.credentialPublicKey || new Uint8Array());
        const counter = credential ? credential.counter : (verification.registrationInfo.counter || 0);
        
        db.savePasskey({
          id: response.id,
          admin_id: req.session.admin_id,
          public_key: Buffer.from(credentialPublicKey).toString('base64'),
          counter: counter,
          device_type: credentialDeviceType,
          backed_up: credentialBackedUp,
          transports: response.response.transports ? response.response.transports.join(',') : '',
        });
        
        req.session.currentChallenge = undefined;
        req.session.save(() => {
          res.json({ verified: true });
        });
      } else {
        res.status(400).json({ verified: false, error: 'Проверка не пройдена' });
      }
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: e.message });
    }
  });
}
