
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

  const isInn = /^\d{10}$|^\d{12}$/.test(query);

  // If query is an INN (10 or 12 digits)
  if (isInn) {
    const { searchSabyCompany } = await import('../services/saby_client.js');
    const sabyRes = await searchSabyCompany(query);
    if (sabyRes && sabyRes.ok && sabyRes.company) {
      return [sabyRes.company];
    }

    // Check local database for EXACT INN match ONLY
    const { db } = await import('../db/crm_store.js');
    const allClients = db.getClients('all');
    const exact = allClients.find(c => c.inn === query);
    if (exact) {
      return [{
        name: exact.company_name,
        inn: exact.inn,
        kpp: exact.kpp || '',
        ogrn: exact.ogrn || '',
        director: exact.director || '',
        address: exact.address || '⚠️ (Уже сохранен в вашей базе данных)'
      }];
    }

    // Never return random unrelated companies when searching by INN!
    return [];
  }

  // Text search (by company name) in local database
  const { db } = await import('../db/crm_store.js');
  const qLower = query.toLowerCase();
  const allClients = db.getClients('all');
  const matched = allClients.filter(c => c.company_name && c.company_name.toLowerCase().includes(qLower));
  
  return matched.slice(0, 5).map(c => ({
    name: c.company_name,
    inn: c.inn,
    kpp: c.kpp,
    ogrn: c.ogrn,
    director: c.director,
    address: '📁 (Из вашей базы клиентов)'
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
