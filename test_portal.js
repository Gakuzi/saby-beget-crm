import { db } from './crm_store.js';
import { renderPortalPage } from './portal_view.js';

try {
  const client = db.getClientById(1);
  if (!client) console.log('Client 1 not found');
  else {
    const token = 'token';
    renderPortalPage({
      client,
      contact: null,
      isAdminPreview: true,
      token,
      activeTab: 'home',
      reqQuery: {}
    });
    console.log('Success');
  }
} catch (e) {
  console.error(e);
}
