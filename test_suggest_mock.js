import { suggestCompany } from './inn_helper.js';

async function run() {
  console.log('Testing suggestCompany...');
  const res = await suggestCompany('7704217370');
  console.log(res);
}
run();
