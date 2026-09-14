import qs from 'qs';
const parsed = qs.parse('contact_names[]=test1&contact_names[]=test2&sites[]=a');
console.log(parsed);
