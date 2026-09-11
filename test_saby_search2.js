import { authenticateSaby, searchSabyCompany } from './saby_client.js';
// The credentials should be read from .saby_config or settings_manager.
// Let's use searchSabyCompany to test "Озон".
async function run() {
  const result = await searchSabyCompany("7704217370"); // Ozon INN
  console.log(result);
}
run();
