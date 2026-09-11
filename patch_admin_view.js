import fs from 'fs';
let code = fs.readFileSync('admin_view.js', 'utf8');

const regex = /<!-- 3\. Infrastructure & Beget Cloud -->[\s\S]*?(?=<!-- 4\. Reports Schedule -->)/;

const newBlock = `<!-- 3. Infrastructure & Hostings -->
          <div style="margin-bottom:28px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
              <h3 style="font-size:16px; font-weight:700; color:#5b21b6; display:flex; align-items:center; gap:8px; margin:0;">
                <span>☁️</span> Инфраструктура: Хостинги и Сайты
              </h3>
              <button type="button" onclick="openAddHostingModal()" class="btn btn-glass" style="font-size:12.5px; padding:6px 14px;">
                <span>+</span> Добавить хостинг
              </button>
            </div>

            <div id="hostings_list" style="display:flex; flex-direction:column; gap:20px;">
              \${hostingAccounts.length === 0 ? '<div style="color:#64748b; font-size:14px; padding:20px; background:#f8fafc; border-radius:8px; text-align:center;">Хостинги не добавлены</div>' : ''}
              
              \${hostingAccounts.map(host => \`
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                    <div>
                      <h4 style="margin:0 0 4px 0; font-size:16px; color:#1e293b;">\${host.provider_name}</h4>
                      <a href="\${host.provider_url}" target="_blank" style="color:#3b82f6; font-size:13px; display:inline-block; margin-bottom:8px;">\${host.provider_url}</a>
                    </div>
                    <button type="button" onclick="deleteHosting(\${host.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;" title="Удалить хостинг">🗑️</button>
                  </div>
                  
                  <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:16px; margin-bottom: 16px; background:#fff; padding:12px; border-radius:6px; border:1px solid #f1f5f9;">
                    <div>
                      <div style="font-size:12px; color:#64748b; margin-bottom:4px;">Логин:</div>
                      <div style="font-size:14px; font-family:monospace;">\${host.login || '—'}</div>
                    </div>
                    <div>
                      <div style="font-size:12px; color:#64748b; margin-bottom:4px;">Пароль:</div>
                      <div style="font-size:14px; font-family:monospace;">\${host.password || '—'}</div>
                    </div>
                    <div>
                      <div style="font-size:12px; color:#64748b; margin-bottom:4px;">API-ключ:</div>
                      <div style="font-size:14px; font-family:monospace;">\${host.api_key || '—'}</div>
                    </div>
                  </div>

                  <div style="margin-top: 16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                      <strong style="font-size:14px; color:#334155;">Сайты на этом хостинге:</strong>
                      <button type="button" onclick="openAddSiteModal(\${host.id})" style="background:#e0e7ff; color:#4338ca; border:none; padding:4px 10px; border-radius:4px; font-size:12px; cursor:pointer; font-weight:600;">+ Добавить сайт</button>
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:8px;">
                      \${clientSites.filter(s => s.hosting_account_id === host.id).length === 0 ? '<div style="font-size:13px; color:#94a3b8;">Нет привязанных сайтов</div>' : ''}
                      
                      \${clientSites.filter(s => s.hosting_account_id === host.id).map(site => \`
                        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
                          <div style="flex:1;">
                            <a href="https://\${site.url}" target="_blank" style="font-weight:600; color:#0f172a; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                              🌐 \${site.url}
                            </a>
                            <span class="badge" style="margin-left:8px; background:#f1f5f9; color:#475569;">\${site.cms_type}</span>
                            <div style="margin-top:6px; font-size:12px; color:#64748b; display:flex; gap:16px;">
                              <span>CMS: \${site.cms_login} / \${site.cms_password || '—'}</span>
                              <span>SSH: \${site.ssh_host ? \`\${site.ssh_user}@\${site.ssh_host}\` : '—'}</span>
                            </div>
                          </div>
                          <div>
                            <button type="button" onclick="deleteSite(\${site.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;" title="Удалить сайт">✖️</button>
                          </div>
                        </div>
                      \`).join('')}
                    </div>
                  </div>
                </div>
              \`).join('')}
            </div>
            
            <!-- Sites without hosting -->
            \${clientSites.filter(s => !s.hosting_account_id).length > 0 ? \`
              <div style="margin-top: 20px;">
                <h4 style="font-size: 14px; color: #64748b; margin-bottom: 12px;">Сайты без привязки к хостингу:</h4>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  \${clientSites.filter(s => !s.hosting_account_id).map(site => \`
                        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; display:flex; justify-content:space-between; align-items:center;">
                          <div style="flex:1;">
                            <a href="https://\${site.url}" target="_blank" style="font-weight:600; color:#0f172a; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                              🌐 \${site.url}
                            </a>
                            <span class="badge" style="margin-left:8px; background:#f1f5f9; color:#475569;">\${site.cms_type}</span>
                          </div>
                          <div>
                            <button type="button" onclick="deleteSite(\${site.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;" title="Удалить сайт">✖️</button>
                          </div>
                        </div>
                  \`).join('')}
                </div>
              </div>
            \` : ''}
            
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed #cbd5e1;">
              <div class="form-group">
                <label>Email адреса для отчётов (через запятую):</label>
                <input type="text" id="setting_emails" name="emails" value="\${client.email_reports || client.emails || ''}" class="form-control" placeholder="client@company.ru">
              </div>
            </div>
          </div>

          <hr style="border:none; border-top:1px solid #e2e8f0; margin: 24px 0;">

          `;

code = code.replace(regex, newBlock);

fs.writeFileSync('admin_view.js', code);
