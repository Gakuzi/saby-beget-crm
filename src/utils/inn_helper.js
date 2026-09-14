
import { db } from '../db/crm_store.js';

export async function checkInnChecksum(inn) {
  if (typeof inn !== 'string' || !inn.match(/^\d{10}$|^\d{12}$/)) return false;
  if (inn.length === 10) {
    const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(inn[i]) * weights[i];
    return (sum % 11) % 10 === parseInt(inn[9]);
  } else {
    const weights11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const weights12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    let sum11 = 0, sum12 = 0;
    for (let i = 0; i < 10; i++) sum11 += parseInt(inn[i]) * weights11[i];
    let check11 = (sum11 % 11) % 10 === parseInt(inn[10]);
    for (let i = 0; i < 11; i++) sum12 += parseInt(inn[i]) * weights12[i];
    let check12 = (sum12 % 11) % 10 === parseInt(inn[11]);
    return check11 && check12;
  }
}

export async function suggestCompany(query) {
  query = (query || '').trim();
  if (!query || query.length < 2) return [];

  const { searchSabyCompany } = await import('../services/saby_client.js');
  
  // If query looks like INN (10 or 12 digits), use searchSabyCompany directly
  if (query.match(/^\d{10}$|^\d{12}$/)) {
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
}

export async function getContracts(inn) {
  if (!inn) return [];
  const { fetchSabyContracts } = await import('../services/saby_client.js');
  const result = await fetchSabyContracts(inn);
  if (result.ok && result.contracts) {
    return result.contracts;
  }
  return [];
}
