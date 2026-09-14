import fs from 'fs';
let code = fs.readFileSync('src/views/admin_view.js', 'utf8');

const oldTabs = `      <a href="?tab=edo" class="tab-btn \${activeTab === 'edo' ? 'active' : ''}">
        <span>📑</span>
        <span>Документы СБИС (\${sabyDocs.length})</span>
      </a>`;

const newTabs = `      <a href="?tab=saby_works" class="tab-btn \${activeTab === 'saby_works' ? 'active' : ''}">
        <span>📋</span>
        <span>Работы Saby (\${sabyWorks.length})</span>
      </a>
      <a href="?tab=saby_requests" class="tab-btn \${activeTab === 'saby_requests' ? 'active' : ''}">
        <span>📞</span>
        <span>Обращения (\${sabyRequests.length})</span>
      </a>
      <a href="?tab=saby_docs" class="tab-btn \${activeTab === 'saby_docs' ? 'active' : ''}">
        <span>📑</span>
        <span>Документы (\${sabyDocs.length})</span>
      </a>`;

code = code.replace(oldTabs, newTabs);

const oldEdoPanel = /<!-- TAB 4: Saby EDO Documents -->[\s\S]*?` : ''}/;

const newSabyPanels = `    <!-- Saby Works -->
    \${activeTab === 'saby_works' ? \`
      <div class="glass-panel" style="padding: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:20px; font-weight:800; color:var(--text-main);">Работы из актов Saby</h2>
          </div>
        </div>
        <div class="table-container">
          <table class="glass-table">
            <thead>
              <tr>
                <th>Акт №</th>
                <th>Дата</th>
                <th>Наименование работы</th>
                <th>Кол-во</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              \${sabyWorks.length > 0 ? sabyWorks.map(w => \`
                <tr>
                  <td style="font-weight:700; color:#1e1b4b;">\${w.document_number}</td>
                  <td style="font-size:13px; color:#64748b;">\${w.date}</td>
                  <td style="font-weight:600;">\${w.work_name}</td>
                  <td>\${w.quantity} \${w.unit}</td>
                  <td style="font-weight:700;">\${w.sum} ₽</td>
                </tr>
              \`).join('') : \`
                <tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">Нет данных о работах в Saby</td></tr>
              \`}
            </tbody>
          </table>
        </div>
      </div>
    \` : ''}

    <!-- Saby Requests -->
    \${activeTab === 'saby_requests' ? \`
      <div class="glass-panel" style="padding: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:20px; font-weight:800; color:var(--text-main);">Обращения клиентов</h2>
          </div>
        </div>
        <div class="table-container">
          <table class="glass-table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Дата</th>
                <th>Тема</th>
                <th>Ответственный</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              \${sabyRequests.length > 0 ? sabyRequests.map(r => \`
                <tr>
                  <td style="font-weight:700;">\${r.number}</td>
                  <td style="font-size:13px; color:#64748b;">\${r.date}</td>
                  <td style="font-weight:600;">\${r.subject}</td>
                  <td>\${r.executor}</td>
                  <td><span class="badge badge-info">\${r.status}</span></td>
                </tr>
              \`).join('') : \`
                <tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">Нет обращений в Saby</td></tr>
              \`}
            </tbody>
          </table>
        </div>
      </div>
    \` : ''}

    <!-- Saby Docs -->
    \${activeTab === 'saby_docs' ? \`
      <div class="glass-panel" style="padding: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:20px; font-weight:800; color:var(--text-main);">Документооборот СБИС ЭДО</h2>
          </div>
        </div>
        <div class="table-container">
          <table class="glass-table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Номер</th>
                <th>Дата</th>
                <th>Сумма</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              \${sabyDocs.length > 0 ? sabyDocs.map(d => \`
                <tr>
                  <td style="font-weight:600; color:#1e1b4b;">\${d.type}</td>
                  <td style="font-weight:700;">\${d.number}</td>
                  <td style="font-size:13px; color:#64748b;">\${d.date}</td>
                  <td style="font-weight:700;">\${d.sum}</td>
                  <td><span class="badge \${d.status === 'Подписан' || d.status === 'Действует' ? 'badge-success' : 'badge-info'}">\${d.status}</span></td>
                </tr>
              \`).join('') : \`
                <tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">Нет сформированных документов СБИС.</td></tr>
              \`}
            </tbody>
          </table>
        </div>
      </div>
    \` : ''}`;

code = code.replace(oldEdoPanel, newSabyPanels);
fs.writeFileSync('src/views/admin_view.js', code);
