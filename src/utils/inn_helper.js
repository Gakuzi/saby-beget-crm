
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
  const results = [];
  const seenInns = new Set();

  // Try Saby first
  try {
    const { searchSabyCompany } = await import('../services/saby_client.js');
    const sabyRes = await searchSabyCompany(query);
    if (sabyRes && sabyRes.ok) {
      const items = sabyRes.items && sabyRes.items.length > 0 ? sabyRes.items : (sabyRes.company ? [sabyRes.company] : []);
      for (const item of items) {
        if (item && item.name) {
          results.push(item);
          if (item.inn) seenInns.add(item.inn);
        }
      }
    }
  } catch (e) {
    // ignore Saby search errors
  }

  // If already found matches from Saby and it was a specific INN, return immediately
  if (isInn && results.length > 0) {
    return results;
  }

  // Check local database
  try {
    const { db } = await import('../db/crm_store.js');
    const qLower = query.toLowerCase();
    const allClients = db.getClients('all');

    for (const c of allClients) {
      const matchesInn = c.inn && (isInn ? c.inn === query : c.inn.includes(query));
      const matchesName = c.company_name && c.company_name.toLowerCase().includes(qLower);

      if ((matchesInn || (!isInn && matchesName)) && !seenInns.has(c.inn)) {
        seenInns.add(c.inn);
        results.push({
          name: c.company_name,
          inn: c.inn,
          kpp: c.kpp || '',
          ogrn: c.ogrn || '',
          director: c.director || '',
          address: c.address ? c.address + ' 📁 (Из базы CRM)' : '📁 (Из вашей базы клиентов)'
        });
      }
    }
  } catch (e) {
    // ignore db error
  }

  return results.slice(0, 10);
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
