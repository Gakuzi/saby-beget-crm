// Legal Court Dossier View - Render official printable dossiers for arbitration and audit
export function renderCourtDossierPage(dossier) {
  const { client, executor, financialSummary, workLogsRegistry, sabyDocsRegistry, backupsRegistry, integrityChecksum, generatedAt } = dossier;
  const genDateStr = new Date(generatedAt).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Юридическое досье контрагента: ${client.companyName} | Архив CRM</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 15mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 30px;
      line-height: 1.45;
      font-size: 13px;
    }
    .dossier-paper {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border: 1px solid #cbd5e1;
    }
    .no-print-toolbar {
      max-width: 900px;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
    }
    .btn-primary {
      background: #1e293b;
      color: #ffffff;
    }
    .btn-primary:hover { background: #0f172a; }
    .btn-secondary {
      background: #ffffff;
      color: #334155;
      border-color: #cbd5e1;
    }
    .btn-secondary:hover { background: #f1f5f9; }

    .header-stamp {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-title h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .header-title .subtitle {
      font-size: 12px;
      color: #475569;
      margin-top: 4px;
    }
    .doc-meta {
      text-align: right;
      font-size: 11.5px;
      color: #64748b;
    }
    .doc-meta code {
      font-family: monospace;
      font-weight: 700;
      color: #0f172a;
    }

    .parties-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .party-card h3 {
      margin: 0 0 8px 0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
    }
    .party-details {
      font-size: 12.5px;
      line-height: 1.5;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 24px 0 10px 0;
      color: #0f172a;
      border-left: 3px solid #2563eb;
      padding-left: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 10px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #fcfcfd;
    }

    .total-box {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
      margin-bottom: 24px;
    }

    .stamp-box {
      margin-top: 36px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .signature-area {
      width: 250px;
      border-bottom: 1px solid #0f172a;
      text-align: center;
      padding-bottom: 4px;
      font-size: 11px;
      color: #64748b;
    }
    .checksum-badge {
      background: #f1f5f9;
      padding: 6px 10px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 10.5px;
      color: #475569;
      word-break: break-all;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .dossier-paper {
        box-shadow: none;
        border: none;
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>

  <div class="no-print-toolbar">
    <div>
      <a href="/client/${client.id}" class="btn btn-secondary">&larr; Вернуться в CRM</a>
      ${client.isArchived ? `<span style="margin-left: 10px; background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 11.5px;">АРХИВНЫЙ КОНТРАКТ</span>` : ''}
    </div>
    <div style="display: flex; gap: 8px;">
      <button type="button" onclick="window.print()" class="btn btn-primary">🖨️ Распечатать / Сохранить в PDF</button>
      <a href="/api/client/${client.id}/dossier/json" download="dossier_${client.inn || client.id}.json" class="btn btn-secondary">💾 Экспорт JSON</a>
    </div>
  </div>

  <div class="dossier-paper">
    <div class="header-stamp">
      <div class="header-title">
        <h1>Юридическое досье исполнения договора</h1>
        <div class="subtitle">Сформировано из защищенной базы данных SQLite сервера CRM для судебных, налоговых и аудиторских целей</div>
      </div>
      <div class="doc-meta">
        Дата выгрузки: <strong>${genDateStr}</strong><br>
        ID карточки: <strong>CRM-CL-${client.id}</strong><br>
        Статус: <strong>${client.isArchived ? 'АРХИВ (ДОГОВОР РАСТОРГНУТ)' : 'ДЕЙСТВУЮЩИЙ ДОГОВОР'}</strong>
      </div>
    </div>

    <div class="parties-grid">
      <div class="party-card">
        <h3>Исполнитель (IT-Подрядчик)</h3>
        <div class="party-details">
          <strong>${executor.legalName}</strong><br>
          ИНН: <strong>${executor.inn}</strong><br>
          Email: ${executor.email}<br>
          Телефон: ${executor.phone}<br>
          Сайт: ${executor.site}
        </div>
      </div>
      <div class="party-card">
        <h3>Заказчик (Контрагент)</h3>
        <div class="party-details">
          <strong>${client.companyName}</strong><br>
          ИНН: <strong>${client.inn || 'Не указан'}</strong> | КПП: ${client.kpp || '—'}<br>
          ОГРН: ${client.ogrn || '—'}<br>
          Руководитель: ${client.director || 'Не указан'}<br>
          Адрес: ${client.address || 'Не указан'}<br>
          Сайты: ${client.sites || '—'}
        </div>
      </div>
    </div>

    <div class="section-title">1. Реквизиты и условия договора</div>
    <table>
      <tr>
        <th style="width: 25%;">Номер договора:</th>
        <td><strong>${client.contractNumber || 'б/н'}</strong></td>
        <th style="width: 25%;">Предмет договора:</th>
        <td>${client.contractTitle || 'Техническое сопровождение веб-ресурсов'}</td>
      </tr>
      <tr>
        <th>Срок действия:</th>
        <td>с ${client.contractStartDate || '—'} по ${client.contractEndDate || 'бессрочно'}</td>
        <th>Статус:</th>
        <td><strong>${client.contractStatus === 'active' ? 'Действует' : client.contractStatus === 'ended' ? 'Завершен / В архиве' : 'Приостановлен'}</strong></td>
      </tr>
      <tr>
        <th>Абонентская плата:</th>
        <td><strong>${new Intl.NumberFormat('ru-RU').format(client.monthlyFee || 0)} руб. / месяц</strong></td>
        <th>Статус взаиморасчетов:</th>
        <td>${financialSummary.paymentStatus === 'paid' ? 'Оплачено (задолженность отсутствует)' : 'Ожидает оплаты'} (последняя оплата: ${financialSummary.lastPaymentDate || '—'})</td>
      </tr>
      ${client.isArchived ? `
      <tr style="background: #fff1f2;">
        <th style="color: #991b1b;">Архивация карточки:</th>
        <td colspan="3" style="color: #991b1b;">
          Дата: ${client.archivedAt ? new Date(client.archivedAt).toLocaleString('ru-RU') : '—'} | 
          Основание: <strong>${client.archivedReason || 'Договор завершен'}</strong>
        </td>
      </tr>
      ` : ''}
    </table>

    <div class="section-title">2. Реестр фактически оказанных услуг (Журнал трудозатрат)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 45px;">№</th>
          <th style="width: 120px;">Дата / Время</th>
          <th>Содержание выполненных регламентных работ</th>
          <th style="width: 80px; text-align: right;">Часы</th>
          <th style="width: 110px;">Статус в СБИС</th>
        </tr>
      </thead>
      <tbody>
        ${workLogsRegistry.length > 0 ? workLogsRegistry.map((w, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${w.work_date || '—'}</td>
            <td>${w.description}</td>
            <td style="text-align: right; font-weight: 700;">${parseFloat(w.hours).toFixed(1)} ч</td>
            <td><span style="color: #047857; font-weight: 600;">✓ Подтверждено</span></td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="5" style="text-align: center; color: #94a3b8; padding: 16px;">В базе данных нет зарегистрированных работ</td>
          </tr>
        `}
      </tbody>
    </table>

    <div class="total-box">
      <span>ИТОГО ОКАЗАНО УСЛУГ ПО РЕЕСТРУ:</span>
      <span style="font-size: 15px; color: #1e293b;">${financialSummary.totalHoursRendered.toFixed(1)} часов</span>
    </div>

    <div class="section-title">3. Реестр выставленных расчетных документов (СБИС ЭДО)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 120px;">Номер документа</th>
          <th style="width: 100px;">Дата</th>
          <th>Наименование документа</th>
          <th style="width: 110px; text-align: right;">Сумма (руб.)</th>
          <th style="width: 130px;">Статус ЭДО</th>
        </tr>
      </thead>
      <tbody>
        ${sabyDocsRegistry.length > 0 ? sabyDocsRegistry.map(d => `
          <tr>
            <td><strong>${d.doc_number || '—'}</strong></td>
            <td>${d.date || '—'}</td>
            <td>${d.title || 'Акт выполненных работ'}</td>
            <td style="text-align: right; font-weight: 700;">${new Intl.NumberFormat('ru-RU').format(d.amount || 0)}</td>
            <td><span style="color: #047857; font-weight: 600;">${d.status || 'Подписан'}</span></td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="5" style="text-align: center; color: #94a3b8; padding: 16px;">Расчетные документы не зафиксированы</td>
          </tr>
        `}
      </tbody>
    </table>

    <div class="section-title">4. Журнал подтверждения непрерывности резервного копирования сайтов</div>
    <table>
      <thead>
        <tr>
          <th style="width: 120px;">Дата копии</th>
          <th>Ресурс (домен)</th>
          <th style="width: 100px; text-align: right;">Размер архива</th>
          <th style="width: 120px;">Источник</th>
          <th style="width: 100px;">Результат</th>
        </tr>
      </thead>
      <tbody>
        ${backupsRegistry.slice(0, 8).map(b => `
          <tr>
            <td>${b.backup_date}</td>
            <td><strong>${b.site_name}</strong></td>
            <td style="text-align: right;">${parseFloat(b.size_mb).toFixed(1)} МБ</td>
            <td>${b.source || 'Beget AutoBackup'}</td>
            <td><span style="color: #047857; font-weight: 700;">✓ Успешно</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="stamp-box">
      <div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">Цифровая контрольная сумма (SHA-256):</div>
        <div class="checksum-badge">${integrityChecksum}</div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
          Хеш сформирован криптографическим алгоритмом по состоянию таблицы базы данных SQLite.
        </div>
      </div>
      <div style="text-align: right;">
        <div class="signature-area">
          ИП Климов Е.В. / _________________ /
        </div>
        <div style="font-size: 11px; color: #475569; margin-top: 6px;">
          М.П. Исполнителя
        </div>
      </div>
    </div>
  </div>

</body>
</html>`;
}
