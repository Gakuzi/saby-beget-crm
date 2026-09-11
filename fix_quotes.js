import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

const oldSites = "div.innerHTML = `\n        <input type=\"text\" name=\"sites[]\" class=\"form-control\" placeholder=\"example.com\">\n        <button type=\"button\" class=\"btn-remove\" onclick=\"this.parentElement.remove()\">×</button>\n      `;";
const newSites = "div.innerHTML = '<input type=\"text\" name=\"sites[]\" class=\"form-control\" placeholder=\"example.com\"><button type=\"button\" class=\"btn-remove\" onclick=\"this.parentElement.remove()\">×</button>';";

const oldContacts = "div.innerHTML = `\n        <input type=\"text\" name=\"contact_names[]\" class=\"form-control\" placeholder=\"Имя Фамилия\" style=\"flex: 1;\">\n        <input type=\"email\" name=\"contact_emails[]\" class=\"form-control\" placeholder=\"email@company.ru\" style=\"flex: 1;\">\n        <button type=\"button\" class=\"btn-remove\" onclick=\"this.parentElement.remove()\">×</button>\n      `;";
const newContacts = "div.innerHTML = '<input type=\"text\" name=\"contact_names[]\" class=\"form-control\" placeholder=\"Имя Фамилия\" style=\"flex: 1;\"><input type=\"email\" name=\"contact_emails[]\" class=\"form-control\" placeholder=\"email@company.ru\" style=\"flex: 1;\"><button type=\"button\" class=\"btn-remove\" onclick=\"this.parentElement.remove()\">×</button>';";

code = code.replace(oldSites, newSites);
code = code.replace(oldContacts, newContacts);

fs.writeFileSync('admin_view.js', code);
