import { getGitHubConfig } from './github_sync.js';
const conf = getGitHubConfig();
console.log('Token exists:', !!conf.token);
