const qs = require('querystring');
const q = require('qs');
console.log(q.parse('sites[]=a&sites[]=b'));
console.log(q.parse('sites=a&sites=b'));
