import fs from 'fs';
let code = fs.readFileSync('src/utils/inn_helper.js', 'utf8');

const newSuggest = `export async function suggestCompany(query) {
  query = (query || '').trim();
  if (!query || query.length < 2) return [];

  const { searchSabyCompany } = await import('../services/saby_client.js');
  
  // If query looks like INN (10 or 12 digits), use searchSabyCompany directly
  if (query.match(/^\\d{10}$|^\\d{12}$/)) {
    const sabyRes = await searchSabyCompany(query);
    if (sabyRes.ok && sabyRes.company) {
      return [sabyRes.company];
    }
  }

  // Local fallback lookup
  const { db } = await import('../db/crm_store.js');
  const qLower = query.toLowerCase();
  const allClients = db.getClients('all');
  const matched = allClients.filter(c => c.company_name.toLowerCase().includes(qLower) || (c.inn && c.inn.includes(qLower)));
  
  return matched.slice(0, 5).map(c => ({
    name: c.company_name,
    inn: c.inn,
    address: '⚠️ (Из локальной базы)'
  }));
}`;

code = code.replace(/export async function suggestCompany\([\s\S]*?export async function getContracts/m, newSuggest + '\n\nexport async function getContracts');
fs.writeFileSync('src/utils/inn_helper.js', code);
