import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

code = code.replace(
  /<label>Часы:<\/label>\s*<input type="number" step="any" min="0.01" name="hours" value="1.0" class="form-control" required>/,
  `<label>Затраченное время (часы, напр. 1.5):</label>
                  <input type="number" step="any" min="0.01" name="hours" value="1.0" class="form-control" required placeholder="Например 0.5 (30 минут) или 1.5">`
);

fs.writeFileSync('admin_view.js', code);
