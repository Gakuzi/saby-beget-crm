// Apple Liquid Glass Admin Views Generator for Clients and Settings
import { db } from './crm_store.js';

function formatDateRus(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateOnly(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function renderAdminClientPage({ client, activeTab = 'works', flashMessage = null, reqQuery = {}, reqHost = '' }) {
  const cId = client.id;
  const logs = db.getWorkLogs(cId);
  const contacts = db.getContacts(cId);
  const summary = db.getPortalSummary(cId);
  const sabyDocs = db.getSabyDocs(cId);
  const syncLogs = db.getSabySyncLogs(cId);
  const backups = db.getBackups(cId);
  const snapshot = db.getLastSnapshot(cId);
  const creds = db.getClientCredentials(cId, { mask: false });
  const clientSites = db.getClientSites(cId);

  const planHours = client.plan_hours || 15;
  const totalHoursUsed = logs.reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0);
  const percentUsed = Math.min(Math.round((totalHoursUsed / planHours) * 100), 100);
  const hoursLeft = Math.max(0, planHours - totalHoursUsed).toFixed(1);

  const syncedCount = logs.filter(l => l.saby_synced).length;
  const unsyncedCount = logs.length - syncedCount;
  const incomingSabyCount = logs.filter(l => l.source === 'saby').length;

  const now = new Date();
  const defaultDateTo = now.toISOString().slice(0, 10);
  const defaultDateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const domainsList = (snapshot?.details?.snapshot?.domains && snapshot.details.snapshot.domains.length > 0)
    ? snapshot.details.snapshot.domains
    : (client.sites ? client.sites.split(',').map(s => ({ fqdn: s.trim(), ssl_status: 'active' })) : [{ fqdn: 'sever-vector.ru', ssl_status: 'active' }]);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Карточка контрагента: ${client.company_name} | Административная панель</title>
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 10% 20%, rgba(238, 242, 255, 0.85) 0%, rgba(245, 243, 255, 0.8) 50%, rgba(248, 250, 252, 0.95) 100%);
      --glass-bg: rgba(255, 255, 255, 0.72);
      --glass-bg-hover: rgba(255, 255, 255, 0.9);
      --glass-border: rgba(255, 255, 255, 0.8);
      --glass-border-subtle: rgba(226, 232, 240, 0.8);
      --glass-shadow: 0 12px 36px 0 rgba(31, 38, 135, 0.06), 0 2px 8px 0 rgba(0, 0, 0, 0.02);
      --glass-shadow-hover: 0 16px 42px 0 rgba(103, 58, 183, 0.12), 0 4px 12px 0 rgba(0, 0, 0, 0.03);
      --primary: #7c3aed;
      --primary-hover: #6d28d9;
      --primary-gradient: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      --primary-gradient-hover: linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%);
      --text-main: #1e1b4b;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.12);
      --info: #0284c7;
      --info-bg: rgba(2, 132, 199, 0.12);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.12);
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.12);
      --radius-xl: 20px;
      --radius-lg: 16px;
      --radius-md: 12px;
      --radius-sm: 8px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      background: var(--bg-gradient);
      min-height: 100vh;
      color: var(--text-main);
      -webkit-font-smoothing: antialiased;
      padding: 24px 20px 60px;
    }

    .ambient-glow-1 {
      position: fixed; width: 500px; height: 500px; border-radius: 50%;
      background: radial-gradient(circle, rgba(167, 139, 250, 0.22) 0%, rgba(255, 255, 255, 0) 70%);
      top: -150px; right: -100px; z-index: 0; pointer-events: none; filter: blur(50px);
    }
    .ambient-glow-2 {
      position: fixed; width: 450px; height: 450px; border-radius: 50%;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, rgba(255, 255, 255, 0) 70%);
      bottom: -100px; left: -100px; z-index: 0; pointer-events: none; filter: blur(60px);
    }

    .container {
      max-width: 1280px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }

    /* Glass Surface utility */
    .glass-panel {
      background: var(--glass-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      box-shadow: var(--glass-shadow);
      transition: all 0.25s ease;
    }

    .glass-card {
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 20px;
      box-shadow: var(--glass-shadow);
      transition: all 0.2s ease;
    }
    .glass-card:hover {
      background: var(--glass-bg-hover);
      box-shadow: var(--glass-shadow-hover);
      transform: translateY(-2px);
    }

    /* Top Navigation / Breadcrumbs */
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #5b21b6;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid var(--glass-border-subtle);
      padding: 8px 16px;
      border-radius: 10px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      backdrop-filter: blur(8px);
      transition: all 0.2s;
    }
    .back-btn:hover {
      background: #ffffff;
      color: var(--primary);
      transform: translateX(-2px);
    }

    /* Header Profile Card */
    .header-card {
      padding: 28px;
      margin-bottom: 24px;
    }

    .header-main {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 20px;
    }

    .company-title-area {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .company-avatar {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: var(--primary-gradient);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 800;
      box-shadow: 0 8px 20px rgba(124, 58, 237, 0.3);
      flex-shrink: 0;
    }

    .company-title {
      font-size: 26px;
      font-weight: 800;
      color: var(--text-main);
      letter-spacing: -0.02em;
    }

    .company-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 6px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-primary { background: rgba(124, 58, 237, 0.12); color: #6d28d9; border: 1px solid rgba(124, 58, 237, 0.2); }
    .badge-success { background: var(--success-bg); color: #065f46; border: 1px solid rgba(16, 185, 129, 0.25); }
    .badge-info { background: var(--info-bg); color: #0369a1; border: 1px solid rgba(2, 132, 199, 0.25); }
    .badge-warning { background: var(--warning-bg); color: #92400e; border: 1px solid rgba(245, 158, 11, 0.25); }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: var(--radius-md);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
      border: none;
    }
    .btn-primary {
      background: var(--primary-gradient);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.25);
    }
    .btn-primary:hover {
      background: var(--primary-gradient-hover);
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(124, 58, 237, 0.35);
    }
    .btn-portal {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(30, 27, 75, 0.25);
    }
    .btn-portal:hover {
      background: #0f172a;
      transform: translateY(-1px);
    }
    .btn-glass {
      background: rgba(255, 255, 255, 0.85);
      color: var(--text-main);
      border: 1px solid var(--glass-border-subtle);
    }
    .btn-glass:hover {
      background: #ffffff;
      border-color: #cbd5e1;
    }
    .btn-success {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
    }

    /* KPI Summary Row */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    @media (max-width: 1024px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 600px) {
      .kpi-grid { grid-template-columns: 1fr; }
    }

    .kpi-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .kpi-clickable {
      cursor: pointer;
      user-select: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .kpi-clickable:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(99, 102, 241, 0.16), 0 0 0 1px rgba(99, 102, 241, 0.3);
    }
    .kpi-clickable:active {
      transform: translateY(0);
    }
    .kpi-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .kpi-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .kpi-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .kpi-val {
      font-size: 28px;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.1;
      margin-bottom: 8px;
    }
    .kpi-sub {
      font-size: 13px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Progress bar */
    .progress-bar-wrap {
      width: 100%;
      height: 7px;
      background: #e2e8f0;
      border-radius: 99px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress-bar-fill {
      height: 100%;
      background: var(--primary-gradient);
      border-radius: 99px;
      transition: width 0.5s ease;
    }

    /* 2-Way Saby Banner */
    .sync-banner {
      padding: 16px 24px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      background: linear-gradient(135deg, rgba(238, 242, 255, 0.95) 0%, rgba(245, 243, 255, 0.95) 100%);
      border: 1px solid rgba(199, 210, 254, 0.9);
      border-radius: var(--radius-lg);
    }
    .sync-banner-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sync-status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
      animation: pulse-dot 2s infinite;
    }
    @keyframes pulse-dot {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
      70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .sync-banner-title {
      font-size: 15px;
      font-weight: 700;
      color: #1e1b4b;
    }
    .sync-banner-sub {
      font-size: 13px;
      color: #64748b;
      margin-top: 2px;
    }

    /* Tabs Navigation */
    .tabs-bar {
      display: flex;
      gap: 8px;
      padding: 6px;
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: 14px;
      margin-bottom: 24px;
      overflow-x: auto;
    }
    .tab-btn {
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      background: transparent;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      transition: all 0.2s;
      text-decoration: none;
    }
    .tab-btn:hover {
      color: var(--text-main);
      background: rgba(255, 255, 255, 0.6);
    }
    .tab-btn.active {
      color: #5b21b6;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.12);
      font-weight: 700;
    }

    /* Forms and Inputs */
    .form-group {
      margin-bottom: 16px;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 6px;
    }
    .form-control {
      width: 100%;
      padding: 11px 14px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      font-size: 14px;
      color: #1e293b;
      outline: none;
      transition: all 0.2s;
    }
    .form-control:focus {
      border-color: #7c3aed;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
    }
    textarea.form-control {
      resize: vertical;
      min-height: 80px;
    }
    select.form-control {
      cursor: pointer;
    }

    /* Work Logs Table */
    .table-container {
      overflow-x: auto;
    }
    table.glass-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 14px;
    }
    table.glass-table th {
      padding: 12px 16px;
      background: rgba(248, 250, 252, 0.8);
      color: #475569;
      font-weight: 600;
      text-align: left;
      font-size: 13px;
      border-bottom: 1px solid #e2e8f0;
      white-space: nowrap;
    }
    table.glass-table th:first-child { border-top-left-radius: 12px; }
    table.glass-table th:last-child { border-top-right-radius: 12px; }
    table.glass-table td {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(226, 232, 240, 0.6);
      color: #1e293b;
      vertical-align: middle;
    }
    table.glass-table tr:hover td {
      background: rgba(255, 255, 255, 0.7);
    }
    table.glass-table tr:last-child td:first-child { border-bottom-left-radius: 12px; }
    table.glass-table tr:last-child td:last-child { border-bottom-right-radius: 12px; }

    /* Flash Message */
    .flash-alert {
      padding: 14px 20px;
      border-radius: 12px;
      margin-bottom: 20px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      font-weight: 500;
    }

    /* Grid Layouts */
    .layout-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
    }
    @media (max-width: 900px) {
      .layout-grid { grid-template-columns: 1fr; }
    }

    /* Live Suggestion Box */
    .suggest-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.15);
      z-index: 50;
      max-height: 280px;
      overflow-y: auto;
      margin-top: 4px;
      display: none;
    }
    .suggest-item {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f1f5f9;
      transition: background 0.15s;
    }
    .suggest-item:hover {
      background: #f8fafc;
    }
    .suggest-item strong {
      color: #1e1b4b;
      font-size: 14px;
    }
    .suggest-item small {
      display: block;
      color: #64748b;
      font-size: 12px;
      margin-top: 2px;
    }

    /* Modal Overlay */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 20px;
    }
    .modal-card {
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
      width: 100%;
      max-width: 580px;
      padding: 28px;
      position: relative;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .modal-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e1b4b;
    }
    .modal-close {
      background: transparent;
      border: none;
      font-size: 22px;
      color: #94a3b8;
      cursor: pointer;
    }
    .modal-close:hover { color: #0f172a; }

    /* Toast Notification */
    .toast-box {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 14px 20px;
      background: #1e1b4b;
      color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.25);
      z-index: 200;
      display: none;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="ambient-glow-1"></div>
  <div class="ambient-glow-2"></div>

  <div class="container">
    <!-- Top Navigation Bar -->
    <div class="top-bar">
      <a href="/" class="back-btn">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
        <span>К списку контрагентов CRM</span>
      </a>

      <div style="display:flex; align-items:center; gap:10px;">
        <a href="/portal/${client.id}" target="_blank" class="btn btn-portal" title="Открыть персональный клиентский портал">
          <span>✨</span>
          <span>Кабинет клиента ↗</span>
        </a>
        <button type="button" onclick="copyClientAccessLink()" class="btn btn-glass" title="Скопировать прямую ссылку авторизации для клиента">
          <span>🔗</span>
          <span>Ссылка клиента</span>
        </button>
      </div>
    </div>

    ${flashMessage ? `
      <div class="flash-alert">
        <span style="font-size:18px;">✅</span>
        <span>${flashMessage}</span>
      </div>
    ` : ''}

    <!-- Main Header Profile Card -->
    <div class="glass-panel header-card">
      <div class="header-main">
        <div class="company-title-area">
          <div class="company-avatar">
            ${client.company_name ? client.company_name.replace(/^(ООО|ИП|АО|ПАО)\s*["«]?/, '').charAt(0) : 'К'}
          </div>
          <div>
            <h1 class="company-title">${client.company_name}</h1>
            <div class="company-badges">
              <span class="badge badge-primary">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                ИНН: ${client.inn}
              </span>
              <span class="badge badge-info">
                <span>📑</span> Saby: ${client.saby_contract_number || 'АС-2024/05'}
              </span>
              <span class="badge badge-success">
                <span>🛡️</span> SLA ${client.sla_target || '99.8'}%
              </span>
              <span class="badge badge-warning">
                <span>☁️</span> Beget: ${client.beget_login || 'alphaserv'}
              </span>
            </div>
          </div>
        </div>

        <div class="header-actions">
          <button type="button" onclick="triggerSabySync(${client.id})" id="sync-top-btn" class="btn btn-primary">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            <span>Синхронизировать с Saby</span>
          </button>
          <a href="/client/${client.id}/report" target="_blank" class="btn btn-glass">
            <span>📊</span>
            <span>Сформировать отчёт</span>
          </a>
        </div>
      </div>
    </div>

    <!-- KPI Summary Grid (Interactive & Clickable) -->
    <div class="kpi-grid">
      <!-- 1. Hours Progress (Clickable) -->
      <div class="glass-card kpi-card kpi-clickable" onclick="openKpiHoursModal()" title="Нажмите для детализации расхода часов по договору" style="cursor: pointer; position: relative; transition: all 0.2s ease;">
        <div class="kpi-header">
          <span class="kpi-label">Лимит часов в месяц</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="kpi-zoom-badge" style="font-size:10px; background:rgba(124,58,237,0.1); color:#6d28d9; padding:2px 6px; border-radius:6px; font-weight:700;">Детали ↗</span>
            <div class="kpi-icon" style="background: rgba(124, 58, 237, 0.12); color: #6d28d9;">⏱️</div>
          </div>
        </div>
        <div>
          <div class="kpi-val">${totalHoursUsed.toFixed(1)} <span style="font-size:16px; font-weight:500; color:#64748b;">/ ${planHours} ч</span></div>
          <div class="kpi-sub">
            <span>Остаток: <strong>${hoursLeft} ч.</strong></span>
            <span style="margin-left:auto; font-weight:700; color:${percentUsed > 90 ? '#ea580c' : '#7c3aed'};">${percentUsed}%</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width: ${percentUsed}%;"></div>
          </div>
        </div>
      </div>

      <!-- 2. Work Logs Count (Clickable) -->
      <div class="glass-card kpi-card kpi-clickable" onclick="location.href='?tab=works#work-table-anchor'" title="Перейти к журналу всех задач и работ" style="cursor: pointer; position: relative; transition: all 0.2s ease;">
        <div class="kpi-header">
          <span class="kpi-label">Всего работ в CRM</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="kpi-zoom-badge" style="font-size:10px; background:rgba(16,185,129,0.1); color:#059669; padding:2px 6px; border-radius:6px; font-weight:700;">Открыть ↗</span>
            <div class="kpi-icon" style="background: rgba(16, 185, 129, 0.12); color: #10b981;">📋</div>
          </div>
        </div>
        <div>
          <div class="kpi-val">${logs.length} <span style="font-size:16px; font-weight:500; color:#64748b;">задач</span></div>
          <div class="kpi-sub">
            <span style="color:#059669; font-weight:600;">✓ Синхронизировано: ${syncedCount}</span>
            ${unsyncedCount > 0 ? `<span style="color:#ea580c; font-weight:600; margin-left:auto;">+${unsyncedCount} новых</span>` : ''}
          </div>
        </div>
      </div>

      <!-- 3. Saby Integration Status (Clickable) -->
      <div class="glass-card kpi-card kpi-clickable" onclick="openKpiSabyModal()" title="Нажмите для просмотра статуса интеграции Saby СБИС" style="cursor: pointer; position: relative; transition: all 0.2s ease;">
        <div class="kpi-header">
          <span class="kpi-label">Шлюз Saby / СБИС ЭДО</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="kpi-zoom-badge" style="font-size:10px; background:rgba(2,132,199,0.1); color:#0284c7; padding:2px 6px; border-radius:6px; font-weight:700;">Статус ↗</span>
            <div class="kpi-icon" style="background: rgba(2, 132, 199, 0.12); color: #0284c7;">⚡</div>
          </div>
        </div>
        <div>
          <div class="kpi-val" style="color:#0284c7; font-size:24px;">Связь активна</div>
          <div class="kpi-sub">
            <span>Договор: <strong>${client.saby_contract_number || 'АС-2024/05'}</strong></span>
          </div>
        </div>
      </div>

      <!-- 4. Beget Hosting Status (Clickable) -->
      <div class="glass-card kpi-card kpi-clickable" onclick="openKpiBackupModal()" title="Нажмите для управления мониторингом бэкапов и хостинга" style="cursor: pointer; position: relative; transition: all 0.2s ease;">
        <div class="kpi-header">
          <span class="kpi-label">Beget Cloud & Резерв</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="kpi-zoom-badge" style="font-size:10px; background:rgba(245,158,11,0.12); color:#d97706; padding:2px 6px; border-radius:6px; font-weight:700;">Бэкапы ↗</span>
            <div class="kpi-icon" style="background: rgba(245, 158, 11, 0.12); color: #d97706;">☁️</div>
          </div>
        </div>
        <div>
          <div class="kpi-val" style="color:#166534; font-size:24px;">100% Норма</div>
          <div class="kpi-sub">
            <span>Бэкапы S3: <strong>Ежедневно</strong> (${domainsList.length} доменов)</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2-Way Saby Synchronization Banner -->
    <div class="sync-banner">
      <div class="sync-banner-info">
        <div class="sync-status-dot"></div>
        <div>
          <div class="sync-banner-title">Двусторонний обмен данными с Saby (СБИС) подключен</div>
          <div class="sync-banner-sub">
            Синхронизировано в Saby: <strong>${syncedCount}</strong> нарядов &bull; Обращений из Saby в CRM: <strong>${incomingSabyCount}</strong> &bull; Все выполненные работы фиксируются с обеих сторон.
          </div>
        </div>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button type="button" onclick="triggerSabySync(${client.id})" class="btn btn-primary" style="padding:8px 16px; font-size:13px;">
          <span>🔄</span>
          <span>Синхронизировать сейчас</span>
        </button>
        <button type="button" onclick="openAddWorkModal()" class="btn btn-glass" style="padding:8px 16px; font-size:13px;">
          <span>+</span>
          <span>Зафиксировать работу</span>
        </button>
      </div>
    </div>

    <!-- Tabs Navigation Bar -->
    <div class="tabs-bar">
      <a href="?tab=works" class="tab-btn ${activeTab === 'works' ? 'active' : ''}">
        <span>💼</span>
        <span>Журнал работ (${logs.length})</span>
      </a>
      <a href="?tab=contacts" class="tab-btn ${activeTab === 'contacts' ? 'active' : ''}">
        <span>👥</span>
        <span>Контакты и 2FA ссылки (${contacts.length})</span>
      </a>
      <a href="?tab=keys" class="tab-btn ${activeTab === 'keys' ? 'active' : ''}">
        <span>🔑</span>
        <span>Доступы и хостинг</span>
      </a>
      <a href="?tab=backups" class="tab-btn ${activeTab === 'backups' ? 'active' : ''}">
        <span>📦</span>
        <span>Бэкапы сайтов (${backups.length})</span>
      </a>
      <a href="?tab=settings" class="tab-btn ${activeTab === 'settings' ? 'active' : ''}">
        <span>⚙️</span>
        <span>Настройки и договор Saby</span>
      </a>
      <a href="?tab=saby_sync" class="tab-btn ${activeTab === 'saby_sync' ? 'active' : ''}">
        <span>🔄</span>
        <span>Синхронизация Saby (${syncLogs.length})</span>
      </a>
      <a href="?tab=edo" class="tab-btn ${activeTab === 'edo' ? 'active' : ''}">
        <span>📑</span>
        <span>Документы СБИС (${sabyDocs.length})</span>
      </a>
      <a href="?tab=report" class="tab-btn ${activeTab === 'report' ? 'active' : ''}">
        <span>📊</span>
        <span>Генерация отчёта</span>
      </a>
    </div>

    <!-- TAB: Contacts & 2FA Access Links -->
    ${activeTab === 'contacts' ? `
      <div class="glass-panel" style="padding: 28px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; flex-wrap:wrap; gap:16px;">
          <div>
            <h2 style="font-size:22px; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:10px;">
              <span>👥</span>
              <span>Контактные лица и закрытый 2FA доступ в Личный кабинет</span>
            </h2>
            <p style="font-size:14px; color:var(--text-secondary); margin-top:4px; max-width:840px; line-height:1.5;">
              Для каждого контактного лица создаётся отдельная ссылка. При переходе на указанную почту высылается 6-значный одноразовый код подтверждения, чтобы гарантировать, что только уполномоченный сотрудник видит финансовые документы и оставляет заявки.
            </p>
          </div>
          <button type="button" onclick="openAddContactModal()" class="btn btn-primary" style="padding:10px 20px;">
            <span>+</span> Добавить контактное лицо
          </button>
        </div>

        <!-- Security Rule Notice -->
        <div style="background:rgba(238, 242, 255, 0.85); border:1px solid #c7d2fe; border-radius:14px; padding:16px 20px; margin-bottom:24px; display:flex; gap:14px; align-items:flex-start;">
          <span style="font-size:26px;">🛡️</span>
          <div style="font-size:13.5px; line-height:1.55; color:#1e1b4b;">
            <strong>Двухфакторная защита финансовой информации:</strong><br>
            В личном кабинете отражаются акты выполненных работ СБИС ЭДО, остатки оплаченных часов и доступы к инфраструктуре. Даже при пересылке ссылки постороннему лицу система затребует подтверждение через почту ответственного лица клиента.
          </div>
        </div>

        <!-- Contacts Table / Cards -->
        ${contacts.length === 0 ? `
          <div style="text-align:center; padding:48px 20px; background:rgba(248, 250, 252, 0.6); border-radius:16px; border:1px dashed #cbd5e1;">
            <div style="font-size:40px; margin-bottom:12px;">👤</div>
            <h3 style="font-size:17px; font-weight:700; color:#1e293b; margin-bottom:6px;">Контактные лица ещё не добавлены</h3>
            <p style="font-size:13.5px; color:#64748b; margin-bottom:20px;">Добавьте первого представителя (руководителя, бухгалтера или IT-специалиста), чтобы выпустить индивидуальную ссылку доступа.</p>
            <button type="button" onclick="openAddContactModal()" class="btn btn-primary">
              <span>+</span> Добавить представителя
            </button>
          </div>
        ` : `
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(380px, 1fr)); gap:20px;">
            ${contacts.map(c => {
              const accessLink = (reqHost ? ('https://' + reqHost) : '') + '/portal?token=' + c.token;
              const roleTitle = c.role === 'full' ? 'Полный доступ (акты + задачи)' : (c.role === 'technical' ? 'Технический (заявки + мониторинг)' : 'Финансовый (акты + счета)');
              const roleBadgeColor = c.role === 'full' ? 'background:#ede9fe; color:#6d28d9; border:1px solid #ddd6fe;' : (c.role === 'technical' ? 'background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;' : 'background:#fef3c7; color:#92400e; border:1px solid #fde68a;');

              return `
                <div class="glass-card" style="padding:22px; display:flex; flex-direction:column; justify-content:space-between; border:1px solid rgba(226,232,240,0.9); border-radius:18px;">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                      <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px;">
                          ${c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div style="font-weight:800; font-size:15.5px; color:#0f172a;">${c.name}</div>
                          <div style="font-size:12.5px; color:#64748b; margin-top:2px;">${c.position || 'Представитель'}</div>
                        </div>
                      </div>
                      <span class="badge" style="font-size:11px; padding:3px 8px; border-radius:8px; font-weight:700; ${roleBadgeColor}">
                        ${roleTitle}
                      </span>
                    </div>

                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; font-size:13px; margin-bottom:14px;">
                      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span style="color:#64748b;">Рабочая почта (2FA):</span>
                        <strong style="color:#0f172a;"><a href="mailto:${c.email}" style="color:#6d28d9; text-decoration:none;">${c.email}</a></strong>
                      </div>
                      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <span style="color:#64748b;">Телефон:</span>
                        <strong style="color:#0f172a;">${c.phone || 'Не указан'}</strong>
                      </div>
                      <div style="display:flex; justify-content:space-between;">
                        <span style="color:#64748b;">Последний вход (2FA):</span>
                        <span style="font-weight:600; color:${c.last_login_at ? '#166534' : '#94a3b8'};">
                          ${c.last_login_at ? formatDateRus(c.last_login_at) : 'Ещё не входил'}
                        </span>
                      </div>
                    </div>

                    <!-- Personal Secret Access Link -->
                    <div style="margin-bottom:14px;">
                      <label style="display:block; font-size:11.5px; font-weight:700; color:#475569; margin-bottom:4px;">
                        🔑 Персональная секретная ссылка входа:
                      </label>
                      <div style="display:flex; gap:6px;">
                        <input type="text" readonly value="${accessLink}" id="link-input-${c.id}" style="flex:1; padding:7px 10px; font-size:12px; font-family:monospace; background:#fff; border:1px solid #cbd5e1; border-radius:8px; color:#334155;">
                        <button type="button" onclick="copyContactLink('${c.id}', '${c.token}')" class="btn btn-glass" style="padding:6px 12px; font-size:12px;" title="Скопировать ссылку">
                          📋
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Actions for Contact -->
                  <div style="display:flex; gap:8px; padding-top:14px; border-top:1px solid #f1f5f9; flex-wrap:wrap; align-items:center; justify-content:space-between;">
                    <div style="display:flex; gap:6px;">
                      <button type="button" onclick="sendContactInvite('${client.id}', '${c.id}', '${c.email}')" class="btn btn-glass" style="padding:6px 12px; font-size:12px; color:#4338ca;" title="Выслать приглашение и ссылку на рабочую почту">
                        ✉️ Выслать на email
                      </button>
                    </div>

                    <div style="display:flex; gap:6px;">
                      <form action="/client/${client.id}/contacts/${c.id}/reissue" method="POST" style="margin:0;" onsubmit="return confirm('Перевыпустить секретную ссылку для ${c.name}? Предыдущая ссылка перестанет действовать.');">
                        <button type="submit" class="btn btn-glass" style="padding:6px 10px; font-size:12px; color:#d97706;" title="Перевыпустить секретный ключ">
                          🔄 Перевыпустить
                        </button>
                      </form>
                      <form action="/client/${client.id}/contacts/${c.id}/delete" method="POST" style="margin:0;" onsubmit="return confirm('Удалить контактное лицо ${c.name}?');">
                        <button type="submit" class="btn btn-glass" style="padding:6px 10px; font-size:12px; color:#ef4444;" title="Удалить">
                          🗑️
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    ` : ''}

    <!-- TAB 1: Works & Incidents (Main Working Desk) -->
    ${activeTab === 'works' ? `
      <div class="layout-grid">
        <!-- Left: Work Logs Table -->
        <div class="glass-panel" style="padding: 24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
            <div>
              <h2 style="font-size:20px; font-weight:800; color:var(--text-main);">Учет выполненных работ и обращений</h2>
              <p style="font-size:13px; color:var(--text-secondary); margin-top:2px;">
                Отражение всех выполненных задач, как в клиентском кабинете, с контролем статуса в Saby
              </p>
            </div>
            <div style="display:flex; gap:8px;">
              <button type="button" onclick="openAddWorkModal()" class="btn btn-primary" style="padding:8px 14px; font-size:13px;">
                <span>+</span>
                <span>Добавить работу</span>
              </button>
            </div>
          </div>

          <div class="table-container">
            <table class="glass-table">
              <thead>
                <tr>
                  <th>Дата / время</th>
                  <th>Категория</th>
                  <th>Описание работы / инцидента</th>
                  <th>Часы</th>
                  <th>Статус в Saby</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                ${logs.length > 0 ? logs.map(l => `
                  <tr>
                    <td style="white-space:nowrap; font-size:13px; color:#64748b;">
                      ${formatDateRus(l.work_date)}
                    </td>
                    <td>
                      <span class="badge ${
                        l.category === 'dev' || l.category === 'development' ? 'badge-primary' :
                        l.category === 'admin' ? 'badge-info' :
                        l.category === 'consult' ? 'badge-warning' : 'badge-success'
                      }">
                        ${l.category_name || (
                          l.category === 'dev' || l.category === 'development' ? 'Разработка' :
                          l.category === 'admin' ? 'Администрирование' :
                          l.category === 'consult' ? 'Консультации' : 'Техподдержка'
                        )}
                      </span>
                    </td>
                    <td>
                      <div style="font-weight:600; color:#1e1b4b; line-height:1.4;">${l.description}</div>
                      ${l.source === 'saby' ? `
                        <div style="font-size:11px; color:#6366f1; font-weight:600; margin-top:2px;">
                          📥 Импортировано из сервис-деска Saby
                        </div>
                      ` : ''}
                    </td>
                    <td style="white-space:nowrap; font-weight:700; color:#1e1b4b;">
                      ${parseFloat(l.hours).toFixed(1)} ч.
                    </td>
                    <td style="white-space:nowrap;">
                      ${l.saby_synced ? `
                        <span class="badge badge-success" title="Зафиксировано в СБИС">
                          ✓ Saby: ${l.saby_task_id || 'Синхронизировано'}
                        </span>
                      ` : `
                        <span class="badge badge-warning" title="Ожидает отправки в СБИС">
                          ⏳ Ожидает отправки
                        </span>
                      `}
                    </td>
                    <td style="white-space:nowrap;">
                      <div style="display:flex; gap:6px;">
                        <button type="button" onclick="editWorkModal(${l.id}, '${l.description.replace(/'/g, "\\'")}', ${l.hours}, '${l.category || 'support'}', '${l.work_date}')" class="btn btn-glass" style="padding:5px 10px; font-size:12px;" title="Редактировать">
                          ✏️
                        </button>
                        <a href="/client/${client.id}/delete_log/${l.id}" onclick="return confirm('Удалить запись о работе?');" class="btn btn-glass" style="padding:5px 10px; font-size:12px; color:#ef4444;" title="Удалить">
                          🗑️
                        </a>
                      </div>
                    </td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="6" style="text-align:center; padding:40px; color:#94a3b8;">
                      В журнале пока нет записей о работах. Используйте форму справа для добавления.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Right: Fast Add Work Form & Saby Widget -->
        <div style="display:flex; flex-direction:column; gap:20px;">
          <!-- Quick Add Work Form -->
          <div class="glass-panel" style="padding: 24px;">
            <h3 style="font-size:17px; font-weight:800; color:var(--text-main); margin-bottom:14px; display:flex; align-items:center; gap:8px;">
              <span>⚡</span> Быстрое добавление работы
            </h3>
            <form action="/client/${client.id}/add_log_advanced" method="POST">
              <div class="form-group">
                <label>Описание выполненной работы / инцидента:</label>
                <textarea name="description" class="form-control" placeholder="Например: Обновление плагинов, тюнинг MySQL, настройка резервного копирования..." required></textarea>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label>Категория:</label>
                  <select name="category" class="form-control">
                    <option value="dev">Разработка</option>
                    <option value="admin">Администрирование</option>
                    <option value="support" selected>Техподдержка</option>
                    <option value="consult">Консультации</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Часы:</label>
                  <input type="number" step="0.5" min="0.1" name="hours" value="1.0" class="form-control" required>
                </div>
              </div>

              <div class="form-group">
                <label>Дата и время (пусто — текущие):</label>
                <input type="datetime-local" name="work_date_local" class="form-control">
              </div>

              <div style="margin: 14px 0; background: rgba(238, 242, 255, 0.7); padding: 12px; border-radius: 10px; border: 1px solid rgba(199, 210, 254, 0.8);">
                <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:#4338ca; cursor:pointer; margin:0;">
                  <input type="checkbox" name="sync_to_saby" value="1" checked style="width:16px; height:16px; accent-color:#7c3aed;">
                  <span>Сразу синхронизировать в Saby (заказ-наряд)</span>
                </label>
              </div>

              <button type="submit" class="btn btn-primary" style="width:100%;">
                <span>💾</span> Сохранить и передать в Saby
              </button>
            </form>
          </div>

          <!-- Contractor Summary Card -->
          <div class="glass-panel" style="padding: 20px;">
            <h4 style="font-size:15px; font-weight:700; color:var(--text-main); margin-bottom:12px;">Реквизиты договора</h4>
            <div style="font-size:13px; line-height:1.7; color:#475569;">
              <div><strong>Номер договора:</strong> ${client.saby_contract_number || 'АС-2024/05'}</div>
              <div><strong>Тариф:</strong> ${client.tariff || '38 000 ₽ / мес'}</div>
              <div><strong>Включено часов:</strong> ${planHours} ч/мес</div>
              <div><strong>Сайты:</strong> ${client.sites || 'alpha-service.pro'}</div>
              <div><strong>Email отчётов:</strong> ${client.email_reports || client.emails || 'Не указан'}</div>
            </div>
            <div style="margin-top:14px; padding-top:12px; border-top:1px solid #e2e8f0;">
              <a href="?tab=settings" class="btn btn-glass" style="width:100%; font-size:13px;">
                <span>⚙️</span> Перейти к настройкам карточки
              </a>
            </div>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- TAB 2: Settings & Saby Contract Setup -->
    ${activeTab === 'settings' ? `
      <div class="glass-panel" style="padding: 28px;">
        <div style="margin-bottom:24px;">
          <h2 style="font-size:22px; font-weight:800; color:var(--text-main);">Настройка карточки контрагента и договора Saby</h2>
          <p style="font-size:14px; color:var(--text-secondary); margin-top:4px;">
            Ввод или обновление ИНН автоматически подтягивает официальное наименование, реквизиты и список договоров из базы Saby
          </p>
        </div>

        <form action="/client/${client.id}/update_full" method="POST" id="client-settings-form">
          <!-- 1. Saby & Legal Requisites -->
          <div style="margin-bottom:28px;">
            <h3 style="font-size:16px; font-weight:700; color:#5b21b6; margin-bottom:14px; display:flex; align-items:center; gap:8px;">
              <span>🏢</span> Реквизиты организации и синхронизация по ИНН
            </h3>

            <div style="display:grid; grid-template-columns: 1fr 2fr; gap:16px;">
              <div class="form-group" style="position:relative;">
                <label>ИНН организации:</label>
                <div style="display:flex; gap:8px;">
                  <input type="text" id="setting_inn" name="inn" value="${client.inn || ''}" class="form-control" placeholder="10 или 12 цифр ИНН" oninput="autoLookupInn(this.value)" autocomplete="off" required>
                  <button type="button" onclick="autoLookupInn(document.getElementById('setting_inn').value)" class="btn btn-glass" style="padding:0 14px;" title="Подтянуть из Saby">
                    🔍
                  </button>
                </div>
                <div id="settings-suggest-box" class="suggest-dropdown"></div>
                <small style="display:block; font-size:11px; color:#64748b; margin-top:4px;">Введите ИНН для авто-подтягивания</small>
              </div>

              <div class="form-group">
                <label>Наименование организации (из Saby / ЕГРЮЛ):</label>
                <input type="text" id="setting_company_name" name="company_name" value="${client.company_name || ''}" class="form-control" required>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:16px;">
              <div class="form-group">
                <label>КПП:</label>
                <input type="text" id="setting_kpp" name="kpp" value="${client.kpp || '780101001'}" class="form-control">
              </div>
              <div class="form-group">
                <label>ОГРН:</label>
                <input type="text" id="setting_ogrn" name="ogrn" value="${client.ogrn || '1157847987654'}" class="form-control">
              </div>
              <div class="form-group">
                <label>Руководитель:</label>
                <input type="text" id="setting_director" name="director" value="${client.director || 'Васильев Андрей Петрович'}" class="form-control">
              </div>
            </div>

            <div class="form-group">
              <label>Юридический адрес:</label>
              <input type="text" id="setting_address" name="address" value="${client.address || 'г. Санкт-Петербург, Невский пр., д. 45'}" class="form-control">
            </div>
          </div>

          <hr style="border:none; border-top:1px solid #e2e8f0; margin: 24px 0;">

          <!-- 2. Saby Contract Selector -->
          <div style="margin-bottom:28px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <h3 style="font-size:16px; font-weight:700; color:#5b21b6; display:flex; align-items:center; gap:8px;">
                <span>📑</span> Выбор договора сопровождения из Saby
              </h3>
              <button type="button" onclick="reloadContractsForClient()" class="btn btn-glass" style="padding:6px 12px; font-size:12px;">
                🔄 Обновить договоры из Saby
              </button>
            </div>

            <div class="form-group">
              <label>Активный договор в системе Saby:</label>
              <select id="setting_contract_select" class="form-control" onchange="onContractSelectChange(this)">
                <option value="${client.saby_contract_id || 'cnt-201'}|||${client.saby_contract_number || 'АС-2024/05'}|||${client.saby_contract_title || 'Договор аутсорсинга веб-инфраструктуры'}|||${planHours}|||${client.tariff || '38 000 ₽ / мес'}">
                  ${client.saby_contract_number || 'АС-2024/05'} — ${client.saby_contract_title || 'Договор аутсорсинга веб-инфраструктуры'} (${planHours} ч/мес, ${client.tariff || '38 000 ₽ / мес'})
                </option>
              </select>
              <input type="hidden" id="setting_contract_id" name="saby_contract_id" value="${client.saby_contract_id || 'cnt-201'}">
              <input type="hidden" id="setting_contract_number" name="saby_contract_number" value="${client.saby_contract_number || 'АС-2024/05'}">
              <input type="hidden" id="setting_contract_title" name="saby_contract_title" value="${client.saby_contract_title || 'Договор аутсорсинга веб-инфраструктуры'}">
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:16px;">
              <div class="form-group">
                <label>Лимит часов по договору (в месяц):</label>
                <input type="number" step="0.5" id="setting_plan_hours" name="plan_hours" value="${planHours}" class="form-control" required>
              </div>
              <div class="form-group">
                <label>Тариф по договору:</label>
                <input type="text" id="setting_tariff" name="tariff" value="${client.tariff || '38 000 ₽ / мес'}" class="form-control">
              </div>
              <div class="form-group">
                <label>Гарантированный SLA:</label>
                <input type="text" name="sla_target" value="${client.sla_target || '99.8%'}" class="form-control">
              </div>
            </div>
          </div>

          <hr style="border:none; border-top:1px solid #e2e8f0; margin: 24px 0;">

          <!-- 3. Infrastructure & Beget Cloud -->
          <div style="margin-bottom:28px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
              <h3 style="font-size:16px; font-weight:700; color:#5b21b6; display:flex; align-items:center; gap:8px; margin:0;">
                <span>☁️</span> Инфраструктура хостинга Beget и сайты
              </h3>
              <button type="button" onclick="refreshBegetData(${client.id})" class="btn btn-glass" style="font-size:12.5px; padding:6px 14px;">
                <span>🌐</span> Запросить актуальные данные с Beget API
              </button>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:16px;">
              <div class="form-group">
                <label>Логин Beget:</label>
                <input type="text" name="beget_login" value="${client.beget_login || ''}" class="form-control" placeholder="alphaserv">
              </div>
              <div class="form-group">
                <label>Пароль Beget:</label>
                <input type="password" name="beget_password" value="${client.beget_password || ''}" class="form-control" placeholder="••••••••">
              </div>
              <div class="form-group">
                <label>API-ключ Beget:</label>
                <input type="text" name="beget_api_key" value="${client.beget_api_key || ''}" class="form-control" placeholder="bg_sec_••••">
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
              <div class="form-group">
                <label>Обслуживаемые сайты и домены (через запятую):</label>
                <input type="text" id="setting_sites" name="sites" value="${client.sites || ''}" class="form-control" placeholder="alpha-service.pro, dev.alpha-service.pro">
              </div>
              <div class="form-group">
                <label>Email адреса для отчётов:</label>
                <input type="text" id="setting_emails" name="emails" value="${client.email_reports || client.emails || ''}" class="form-control" placeholder="client@company.ru">
              </div>
            </div>
          </div>

          <hr style="border:none; border-top:1px solid #e2e8f0; margin: 24px 0;">

          <!-- 4. Reports Schedule -->
          <div style="margin-bottom:28px;">
            <h3 style="font-size:16px; font-weight:700; color:#5b21b6; margin-bottom:14px; display:flex; align-items:center; gap:8px;">
              <span>🗓️</span> График рассылки регламентных отчётов
            </h3>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
              <div class="form-group">
                <label>Периодичность отправки:</label>
                <select name="report_schedule" class="form-control">
                  <option value="none" ${client.report_schedule === 'none' ? 'selected' : ''}>Не отправлять автоматически</option>
                  <option value="daily" ${client.report_schedule === 'daily' ? 'selected' : ''}>Ежедневно (за предыдущий день)</option>
                  <option value="weekly" ${client.report_schedule === 'weekly' ? 'selected' : ''}>Еженедельно (по понедельникам)</option>
                  <option value="monthly" ${client.report_schedule === 'monthly' || !client.report_schedule ? 'selected' : ''}>Ежемесячно (1-го числа за прошлый месяц)</option>
                </select>
              </div>

              <div class="form-group">
                <label>День старта / формирования (1–28):</label>
                <input type="number" min="1" max="28" name="report_start_day" value="${client.report_start_day || 1}" class="form-control">
              </div>
            </div>

            <div style="background:rgba(248,250,252,0.8); padding:16px; border-radius:12px; border:1px solid #e2e8f0;">
              <label style="font-weight:700; font-size:13px; color:#334155; margin-bottom:8px; display:block;">Включаемые разделы отчёта:</label>
              <div style="display:flex; flex-wrap:wrap; gap:16px; font-size:13px;">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" name="report_sections" value="backups" checked> Резервные копии и 1С-Битрикс</label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" name="report_sections" value="host_events" checked> Мониторинг хостинга и БД</label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" name="report_sections" value="mailboxes" checked> Почта и DNS</label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" name="report_sections" value="account" checked> Баланс Beget</label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" name="report_sections" value="certs" checked> SSL-сертификаты</label>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <a href="?tab=works" class="btn btn-glass">Отмена</a>
            <button type="submit" class="btn btn-primary" style="padding:12px 28px; font-size:15px;">
              <span>💾</span> Сохранить все изменения
            </button>
          </div>
        </form>
      </div>
    ` : ''}

    <!-- TAB 3: 2-Way Saby Synchronization Logs & Controls -->
    ${activeTab === 'saby_sync' ? `
      <div class="glass-panel" style="padding: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:20px; font-weight:800; color:var(--text-main);">Двусторонняя интеграция с Saby (СБИС)</h2>
            <p style="font-size:13px; color:var(--text-secondary); margin-top:2px;">
              Автоматический обмен: работы из CRM регистрируются в Saby, а обращения из Saby импортируются в журнал CRM
            </p>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <button type="button" onclick="testSabyRPC()" class="btn btn-glass" style="font-size:13px;">
              <span>⚡</span> Проверить шлюз Saby
            </button>
            <button type="button" onclick="triggerSabySync(${client.id})" class="btn btn-primary">
              <span>🔄</span>
              <span>Запустить синхронизацию</span>
            </button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px;">
          <!-- Outbound Card -->
          <div class="glass-card">
            <h3 style="font-size:16px; font-weight:700; color:#5b21b6; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
              <span>📤</span> Направление: CRM &rarr; Saby
            </h3>
            <p style="font-size:13px; color:#475569; line-height:1.5; margin-bottom:12px;">
              Все выполненные специалистами работы передаются в Saby как заказ-наряды по договору <strong>${client.saby_contract_number || 'АС-2024/05'}</strong> с фиксацией затраченного времени.
            </p>
            <div style="font-size:14px; font-weight:700; color:#059669;">
              ✓ Передано нарядов: ${syncedCount}
            </div>
          </div>

          <!-- Inbound Card -->
          <div class="glass-card">
            <h3 style="font-size:16px; font-weight:700; color:#0284c7; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
              <span>📥</span> Направление: Saby &rarr; CRM
            </h3>
            <p style="font-size:13px; color:#475569; line-height:1.5; margin-bottom:12px;">
              Обращения, наряды и заявки из сервис-деска Saby автоматически регистрируются в нашей CRM-системе и отображаются в журнале работ.
            </p>
            <div style="font-size:14px; font-weight:700; color:#0284c7;">
              ✓ Принято обращений: ${incomingSabyCount}
            </div>
          </div>
        </div>

        <h3 style="font-size:16px; font-weight:800; color:var(--text-main); margin-bottom:14px;">Журнал сессий синхронизации</h3>
        <div class="table-container">
          <table class="glass-table">
            <thead>
              <tr>
                <th>Время сессии</th>
                <th>Направление</th>
                <th>Статус</th>
                <th>Результат синхронизации</th>
              </tr>
            </thead>
            <tbody>
              ${syncLogs.length > 0 ? syncLogs.map(s => `
                <tr>
                  <td style="white-space:nowrap; font-size:13px; color:#64748b;">${formatDateRus(s.timestamp)}</td>
                  <td>
                    <span class="badge ${s.direction === 'two_way' ? 'badge-primary' : s.direction === 'outbound' ? 'badge-info' : 'badge-success'}">
                      ${s.direction === 'two_way' ? 'Двусторонняя' : s.direction === 'outbound' ? 'CRM → Saby' : 'Saby → CRM'}
                    </span>
                  </td>
                  <td>
                    <span class="badge badge-success">✓ ${s.status || 'Успешно'}</span>
                  </td>
                  <td style="font-weight:600; color:#1e1b4b;">${s.message || 'Синхронизировано'}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">
                    Журнал синхронизации пуст. Нажмите «Запустить синхронизацию» выше.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    <!-- TAB 4: Saby EDO Documents -->
    ${activeTab === 'edo' ? `
      <div class="glass-panel" style="padding: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:20px; font-weight:800; color:var(--text-main);">Документооборот СБИС ЭДО</h2>
            <p style="font-size:13px; color:var(--text-secondary); margin-top:2px;">
              Действующие договоры, акты выполненных работ и акты сверки взаимных расчетов
            </p>
          </div>
          <button type="button" onclick="openCreateActModal()" class="btn btn-primary">
            <span>+</span>
            <span>Сформировать акт в СБИС</span>
          </button>
        </div>

        <div class="table-container">
          <table class="glass-table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Дата</th>
                <th>Наименование документа</th>
                <th>Сумма</th>
                <th>Статус ЭДО</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              ${sabyDocs.length > 0 ? sabyDocs.map(d => `
                <tr>
                  <td style="font-weight:700; white-space:nowrap; color:#1e1b4b;">${d.number}</td>
                  <td style="white-space:nowrap; font-size:13px; color:#64748b;">${d.date}</td>
                  <td style="font-weight:600; color:#1e1b4b;">${d.title}</td>
                  <td style="white-space:nowrap; font-weight:700;">${d.amount}</td>
                  <td>
                    <span class="badge ${d.status === 'Подписан' || d.status === 'Действует' ? 'badge-success' : 'badge-info'}">
                      ${d.edo_status || d.status}
                    </span>
                  </td>
                  <td style="white-space:nowrap;">
                    <a href="#" onclick="showToast('Документ открыт в СБИС ЭДО'); return false;" class="btn btn-glass" style="padding:5px 12px; font-size:12px;">
                      Открыть в СБИС
                    </a>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">
                    Нет сформированных документов СБИС.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    <!-- TAB 5: Report Generation -->
    ${activeTab === 'report' ? `
      <div class="glass-panel" style="padding: 24px;">
        <h2 style="font-size:20px; font-weight:800; color:var(--text-main); margin-bottom:12px;">Генератор регламентного отчёта</h2>
        <p style="font-size:14px; color:var(--text-secondary); margin-bottom:20px;">
          Формирование детального отчёта со всеми выполненными работами, инцидентами, бэкапами Beget Cloud и статусом SSL-сертификатов
        </p>

        <form action="/client/${client.id}/report" method="GET" target="_blank" style="background:rgba(248,250,252,0.8); padding:20px; border-radius:14px; border:1px solid #e2e8f0;">
          <div style="display:flex; gap:16px; align-items:flex-end; flex-wrap:wrap; margin-bottom:16px;">
            <div style="flex:1; min-width:160px;">
              <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:6px;">Дата с:</label>
              <input type="date" name="date_from" id="report_date_from" value="${defaultDateFrom}" class="form-control" required>
            </div>
            <div style="flex:1; min-width:160px;">
              <label style="display:block; font-size:13px; font-weight:600; color:#475569; margin-bottom:6px;">Дата по:</label>
              <input type="date" name="date_to" id="report_date_to" value="${defaultDateTo}" class="form-control" required>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" onclick="setFilterDates('this_month')" class="btn btn-glass" style="font-size:13px;">Текущий месяц</button>
              <button type="button" onclick="setFilterDates('prev_month')" class="btn btn-glass" style="font-size:13px;">Прошлый месяц</button>
              <button type="button" onclick="setFilterDates('7_days')" class="btn btn-glass" style="font-size:13px;">7 дней</button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="padding:12px 24px; font-size:15px;">
            <span>📊</span> Сформировать регламентный отчёт
          </button>
        </form>
      </div>
    ` : ''}

    <!-- TAB: KEYS & INFRASTRUCTURE -->
    ${activeTab === 'keys' ? `
      <div class="glass-panel" style="padding: 26px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:20px; font-weight:800; color:var(--text-main); margin-bottom:4px;">🔑 Учетные записи, хостинг и доступы к сайтам</h2>
            <p style="font-size:14px; color:var(--text-secondary);">
              Централизованное управление серверами, FTP, SSH-ключами, 1С-Битрикс и быстрый переход в нужные разделы хостинга
            </p>
          </div>
          <!-- Quick Direct Navigation Ribbon -->
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" onclick="openSshTerminalModal()" class="btn" style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color:#38bdf8; font-family:monospace; font-weight:700; border:1px solid #334155;">
              <span>🖥️</span> Web-терминал SSH &nearr;
            </button>
            <button type="button" onclick="openBackupAgentModal()" class="btn" style="background:linear-gradient(135deg, #4338ca 0%, #3730a3 100%); color:#fff; font-weight:700;">
              <span>🤖</span> Агент авто-бэкапов
            </button>
            ${creds.bitrix_admin_url ? `
              <a href="${creds.bitrix_admin_url}" target="_blank" class="btn" style="background:#dc2626; color:#fff; font-weight:700;">
                <span>🔑</span> Вход в Битрикс &nearr;
              </a>
            ` : ''}
            <a href="${creds.hosting_url || 'https://cp.beget.com'}" target="_blank" class="btn btn-glass">
              <span>🌐</span> Хостинг &nearr;
            </a>
          </div>
        </div>

        <!-- Quick Access Action Cards Row -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:24px;">
          <a href="${creds.hosting_url ? creds.hosting_url + (creds.hosting_url.includes('beget') ? '/fm' : '') : 'https://cp.beget.com/fm'}" target="_blank" class="glass-card" style="padding:12px 14px; text-decoration:none; display:flex; align-items:center; gap:10px; border:1px solid #e2e8f0; border-radius:12px;">
            <span style="font-size:22px;">📁</span>
            <div>
              <div style="font-weight:700; font-size:13px; color:#1e1b4b;">Файловый менеджер ↗</div>
              <div style="font-size:11px; color:#64748b;">Папка сайтов / public_html</div>
            </div>
          </a>

          <a href="${creds.hosting_url ? creds.hosting_url + (creds.hosting_url.includes('beget') ? '/cron' : '') : 'https://cp.beget.com/cron'}" target="_blank" class="glass-card" style="padding:12px 14px; text-decoration:none; display:flex; align-items:center; gap:10px; border:1px solid #e2e8f0; border-radius:12px;">
            <span style="font-size:22px;">⏰</span>
            <div>
              <div style="font-weight:700; font-size:13px; color:#1e1b4b;">Планировщик Cron ↗</div>
              <div style="font-size:11px; color:#64748b;">Автоматический запуск скриптов</div>
            </div>
          </a>

          <a href="${creds.hosting_url ? creds.hosting_url + (creds.hosting_url.includes('beget') ? '/db' : '') : 'https://cp.beget.com/db'}" target="_blank" class="glass-card" style="padding:12px 14px; text-decoration:none; display:flex; align-items:center; gap:10px; border:1px solid #e2e8f0; border-radius:12px;">
            <span style="font-size:22px;">🗄️</span>
            <div>
              <div style="font-weight:700; font-size:13px; color:#1e1b4b;">Базы данных / phpMyAdmin ↗</div>
              <div style="font-size:11px; color:#64748b;">Управление MySQL и таблицами</div>
            </div>
          </a>

          <a href="${creds.hosting_url ? creds.hosting_url + (creds.hosting_url.includes('beget') ? '/backup' : '') : 'https://cp.beget.com/backup'}" target="_blank" class="glass-card" style="padding:12px 14px; text-decoration:none; display:flex; align-items:center; gap:10px; border:1px solid #e2e8f0; border-radius:12px;">
            <span style="font-size:22px;">📦</span>
            <div>
              <div style="font-weight:700; font-size:13px; color:#1e1b4b;">Бэкапы хостинга ↗</div>
              <div style="font-size:11px; color:#64748b;">Архивы сайтов и БД на Beget</div>
            </div>
          </a>
        </div>

        <form action="/client/${client.id}/update_full" method="POST">
          <input type="hidden" name="active_tab" value="keys">
          
          <!-- Keep existing basic fields so they are not wiped -->
          <input type="hidden" name="company_name" value="${client.company_name || ''}">
          <input type="hidden" name="inn" value="${client.inn || ''}">
          <input type="hidden" name="kpp" value="${client.kpp || ''}">
          <input type="hidden" name="ogrn" value="${client.ogrn || ''}">
          <input type="hidden" name="director" value="${client.director || ''}">
          <input type="hidden" name="address" value="${client.address || ''}">
          <input type="hidden" name="sites" value="${client.sites || ''}">
          <input type="hidden" name="emails" value="${client.emails || ''}">
          <input type="hidden" name="tariff" value="${client.tariff || ''}">
          <input type="hidden" name="plan_hours" value="${client.plan_hours || ''}">
          <input type="hidden" name="sla_target" value="${client.sla_target || ''}">
          <input type="hidden" name="saby_contract_number" value="${client.saby_contract_number || ''}">
          <input type="hidden" name="saby_contract_date" value="${client.saby_contract_date || ''}">

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap:20px; margin-bottom:24px;">
            
            <!-- SECTION 1: HOSTING -->
            <div style="background: rgba(248,250,252,0.85); border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
                <h3 style="font-size:16px; font-weight:700; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
                  <span>☁️</span> Хостинг и Cloud API
                </h3>
                <div style="display:flex; gap:6px;">
                  <a href="${creds.hosting_url || 'https://cp.beget.com'}" target="_blank" class="badge badge-warning" style="font-size:11px; text-decoration:none;">Открыть панель ↗</a>
                </div>
              </div>

              <div class="form-group">
                <label>Провайдер хостинга:</label>
                <input type="text" name="cred_hosting_provider" value="${creds.hosting_provider || 'Beget'}" class="form-control" placeholder="Beget, TimeWeb, Reg.ru, VPS">
              </div>

              <div class="form-group">
                <label>URL панели управления хостинга:</label>
                <div style="display:flex; gap:8px;">
                  <input type="text" name="cred_hosting_url" id="inp_hosting_url" value="${creds.hosting_url || (client.beget_login ? 'https://cp.beget.com' : '')}" class="form-control" placeholder="https://cp.beget.com">
                  <a href="${creds.hosting_url || 'https://cp.beget.com'}" target="_blank" class="btn btn-glass" style="padding:8px 12px;" title="Открыть хостинг">↗</a>
                </div>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label>Логин хостинга:</label>
                  <input type="text" name="cred_hosting_login" id="inp_hosting_login" value="${creds.hosting_login || client.beget_login || ''}" class="form-control">
                </div>
                <div class="form-group">
                  <label>Пароль хостинга:</label>
                  <div style="display:flex; gap:6px;">
                    <input type="password" name="cred_hosting_password" id="inp_hosting_pass" value="${creds.hosting_password || client.beget_password || ''}" class="form-control">
                    <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="togglePassVisibility('inp_hosting_pass')">👁️</button>
                    <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="copyTextValue(document.getElementById('inp_hosting_pass').value, 'Пароль хостинга')">📋</button>
                  </div>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:0;">
                <label>API-ключ хостинга (для бэкапов и DNS):</label>
                <div style="display:flex; gap:6px;">
                  <input type="password" name="cred_hosting_api_key" id="inp_hosting_api" value="${creds.hosting_api_key || client.beget_api_key || ''}" class="form-control" placeholder="Токен API">
                  <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="togglePassVisibility('inp_hosting_api')">👁️</button>
                  <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="copyTextValue(document.getElementById('inp_hosting_api').value, 'API-ключ')">📋</button>
                </div>
              </div>
            </div>

            <!-- SECTION 2: 1C-BITRIX ADMIN -->
            <div style="background: rgba(248,250,252,0.85); border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; border-top: 3px solid #dc2626;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
                <h3 style="font-size:16px; font-weight:700; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
                  <span>🔑</span> Панель 1С-Битрикс
                </h3>
                <div style="display:flex; gap:6px;">
                  ${creds.bitrix_admin_url ? `
                    <a href="${creds.bitrix_admin_url.replace(/\/admin\/.*$/, '/admin/dump.php')}" target="_blank" class="badge badge-info" style="font-size:11px; text-decoration:none;">Бэкапы Битрикс ↗</a>
                  ` : ''}
                </div>
              </div>

              <div class="form-group">
                <label>URL административной панели (/bitrix/admin/):</label>
                <div style="display:flex; gap:8px;">
                  <input type="text" name="cred_bitrix_admin_url" id="inp_bitrix_url" value="${creds.bitrix_admin_url || (clientSites[0] ? clientSites[0].bitrix_admin_url : '')}" class="form-control" placeholder="https://site.ru/bitrix/admin/">
                  ${creds.bitrix_admin_url ? `<a href="${creds.bitrix_admin_url}" target="_blank" class="btn btn-glass" style="padding:8px 12px; background:#dc2626; color:#fff;" title="Войти в Битрикс">Войти ↗</a>` : ''}
                </div>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label>Логин администратора:</label>
                  <input type="text" name="cred_bitrix_login" id="inp_bitrix_login" value="${creds.bitrix_login || 'admin'}" class="form-control">
                </div>
                <div class="form-group">
                  <label>Пароль администратора:</label>
                  <div style="display:flex; gap:6px;">
                    <input type="password" name="cred_bitrix_password" id="inp_bitrix_pass" value="${creds.bitrix_password || ''}" class="form-control">
                    <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="togglePassVisibility('inp_bitrix_pass')">👁️</button>
                    <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="copyTextValue(document.getElementById('inp_bitrix_pass').value, 'Пароль 1С-Битрикс')">📋</button>
                  </div>
                </div>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:0;">
                <div class="form-group" style="margin-bottom:0;">
                  <label>Редакция / Версия Битрикс:</label>
                  <input type="text" name="cred_bitrix_version" value="${creds.bitrix_version || '24.100.0 (Стандарт)'}" class="form-control">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label>Версия PHP:</label>
                  <input type="text" name="cred_php_version" value="${creds.php_version || '8.2'}" class="form-control">
                </div>
              </div>
            </div>

            <!-- SECTION 3: SSH / SFTP & CONSOLE -->
            <div style="background: rgba(248,250,252,0.85); border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; border-top: 3px solid #0284c7;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
                <h3 style="font-size:16px; font-weight:700; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
                  <span>💻</span> Сервер SSH & SFTP (Root Доступ)
                </h3>
                <div style="display:flex; gap:6px;">
                  <button type="button" onclick="testSshConnection()" class="btn btn-glass" style="font-size:11px; padding:3px 8px;">⚡ Тест связи</button>
                  <button type="button" onclick="openSshTerminalModal()" class="badge" style="background:#0f172a; color:#38bdf8; font-family:monospace; border:none; cursor:pointer; font-size:11px; padding:4px 8px; border-radius:6px;">🖥️ Терминал</button>
                </div>
              </div>

              <div style="display:grid; grid-template-columns: 3fr 1fr; gap:12px;">
                <div class="form-group">
                  <label>Хост (IP или FQDN):</label>
                  <input type="text" name="cred_ssh_host" id="inp_ssh_host" value="${creds.ssh_host || ''}" class="form-control" placeholder="185.xxx.xxx.xxx или domain.ru">
                </div>
                <div class="form-group">
                  <label>Порт:</label>
                  <input type="number" name="cred_ssh_port" id="inp_ssh_port" value="${creds.ssh_port || 22}" class="form-control">
                </div>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label>Пользователь (User):</label>
                  <input type="text" name="cred_ssh_user" id="inp_ssh_user" value="${creds.ssh_user || 'root'}" class="form-control">
                </div>
                <div class="form-group">
                  <label>Пароль SSH:</label>
                  <div style="display:flex; gap:6px;">
                    <input type="password" name="cred_ssh_password" id="inp_ssh_pass" value="${creds.ssh_password || ''}" class="form-control">
                    <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="togglePassVisibility('inp_ssh_pass')">👁️</button>
                    <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="copyTextValue(document.getElementById('inp_ssh_pass').value, 'Пароль SSH')">📋</button>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label>Приватный SSH-ключ (OpenSSH / ED25519 / RSA):</label>
                <div style="position:relative;">
                  <textarea name="cred_ssh_key" id="inp_ssh_key" rows="2" class="form-control" style="font-family:monospace; font-size:11px;" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...">${creds.ssh_key || ''}</textarea>
                </div>
              </div>

              <div class="form-group">
                <label>Корневой каталог сайта на сервере:</label>
                <input type="text" name="cred_web_root_dir" id="inp_web_root_dir" value="${creds.web_root_dir || '/home/bitrix/www'}" class="form-control" placeholder="/home/bitrix/www или /home/login/domain/public_html">
              </div>

              <!-- Quick SSH Buttons -->
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
                <button type="button" class="btn btn-glass" style="flex:1; font-size:12px;" onclick="openSshTerminalModal()">
                  🖥️ Открыть Web-терминал
                </button>
                <button type="button" class="btn btn-glass" style="flex:1; font-size:12px;" onclick="autoInstallAgentViaSsh()">
                  🚀 Установить агент бэкапов
                </button>
                <button type="button" class="btn btn-glass" style="font-size:12px;" onclick="copyTextValue('ssh ' + (document.getElementById('inp_ssh_user').value || 'root') + '@' + (document.getElementById('inp_ssh_host').value || 'host') + ' -p ' + (document.getElementById('inp_ssh_port').value || 22), 'Команда SSH')">
                  📋 Команда SSH
                </button>
              </div>
            </div>

            <!-- SECTION 4: FTP / SFTP -->
            <div style="background: rgba(248,250,252,0.85); border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
                <h3 style="font-size:16px; font-weight:700; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
                  <span>📡</span> Доступ по FTP / SFTP
                </h3>
                <span class="badge badge-info" style="font-size:11px;">FileZilla / WinSCP</span>
              </div>

              <div style="display:grid; grid-template-columns: 3fr 1fr; gap:12px;">
                <div class="form-group">
                  <label>FTP Сервер (Host):</label>
                  <input type="text" name="cred_ftp_host" id="inp_ftp_host" value="${creds.ftp_host || creds.ssh_host || ''}" class="form-control" placeholder="ftp.domain.ru или IP">
                </div>
                <div class="form-group">
                  <label>Порт:</label>
                  <input type="number" name="cred_ftp_port" id="inp_ftp_port" value="${creds.ftp_port || 21}" class="form-control">
                </div>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label>Логин FTP:</label>
                  <input type="text" name="cred_ftp_user" id="inp_ftp_user" value="${creds.ftp_user || creds.hosting_login || ''}" class="form-control">
                </div>
                <div class="form-group">
                  <label>Пароль FTP:</label>
                  <div style="display:flex; gap:6px;">
                    <input type="password" name="cred_ftp_password" id="inp_ftp_pass" value="${creds.ftp_password || ''}" class="form-control">
                    <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="togglePassVisibility('inp_ftp_pass')">👁️</button>
                    <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="copyTextValue(document.getElementById('inp_ftp_pass').value, 'Пароль FTP')">📋</button>
                  </div>
                </div>
              </div>

              <div style="display:flex; gap:8px; margin-top:6px;">
                <button type="button" class="btn btn-glass" style="width:100%; font-size:12px;" onclick="openFtpClient()">
                  📡 Открыть в FileZilla / FTP-клиенте
                </button>
                <button type="button" class="btn btn-glass" style="font-size:12px;" onclick="copyFtpParams()">
                  📋 Скопировать данные FTP
                </button>
              </div>
            </div>

            <!-- SECTION 5: MYSQL DATABASE -->
            <div style="background: rgba(248,250,252,0.85); border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
                <h3 style="font-size:16px; font-weight:700; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
                  <span>🗄️</span> База данных MySQL
                </h3>
                <div style="display:flex; gap:6px;">
                  <a href="${creds.hosting_url ? creds.hosting_url + (creds.hosting_url.includes('beget') ? '/db' : '') : 'https://cp.beget.com/db'}" target="_blank" class="badge badge-success" style="font-size:11px; text-decoration:none;">phpMyAdmin ↗</a>
                </div>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label>Сервер БД (Host):</label>
                  <input type="text" name="cred_mysql_host" value="${creds.mysql_host || 'localhost'}" class="form-control">
                </div>
                <div class="form-group">
                  <label>Имя базы данных:</label>
                  <input type="text" name="cred_mysql_name" value="${creds.mysql_name || ''}" class="form-control" placeholder="bitrix_db">
                </div>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:0;">
                <div class="form-group" style="margin-bottom:0;">
                  <label>Пользователь БД:</label>
                  <input type="text" name="cred_mysql_user" value="${creds.mysql_user || ''}" class="form-control">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label>Пароль БД:</label>
                  <div style="display:flex; gap:6px;">
                    <input type="password" name="cred_mysql_password" id="inp_mysql_pass" value="${creds.mysql_password || ''}" class="form-control">
                    <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="togglePassVisibility('inp_mysql_pass')">👁️</button>
                    <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="copyTextValue(document.getElementById('inp_mysql_pass').value, 'Пароль БД')">📋</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- SECTION 6: AUTOMATED BACKUP AGENT (ALL CLIENT SITES) -->
            <div style="background: rgba(248,250,252,0.85); border: 1px solid #c7d2fe; border-radius: 14px; padding: 20px; grid-column: 1 / -1; border-left: 4px solid #4f46e5;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
                <div>
                  <h3 style="font-size:16px; font-weight:800; color:#1e1b4b; display:flex; align-items:center; gap:8px; margin:0 0 4px;">
                    <span>🤖</span> Агент автоматического сбора бэкапов со всех сайтов контрагента
                  </h3>
                  <p style="font-size:13px; color:#475569; margin:0; line-height:1.5;">
                    Единый скрипт автоматически сканирует архивы 1С-Битрикс по всем доменам клиента (${clientSites.map(s => s.domain).join(', ') || 'главный сайт'}), вычисляет размер, статус и передает отчет в CRM.
                  </p>
                </div>
                <div style="display:flex; gap:6px;">
                  <a href="/api/client/${client.id}/backup-agent.php" download="crm_backup_agent.php" class="btn btn-primary" style="font-size:12.5px; padding:8px 14px;">
                    📥 Скачать crm_backup_agent.php
                  </a>
                  <button type="button" onclick="openBackupAgentModal()" class="btn btn-glass" style="font-size:12.5px; padding:8px 14px;">
                    📖 Инструкция и код
                  </button>
                </div>
              </div>

              <!-- Step-by-step instructions -->
              <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; font-size:13px; line-height:1.6; margin-bottom:14px;">
                <div style="margin-bottom:8px;">
                  <strong>1. Размещение скрипта на сервере:</strong> Скачайте или скопируйте файл <code>crm_backup_agent.php</code> и загрузите его в корень сайта:
                  <div style="margin:4px 0; color:#4338ca; font-family:monospace; font-size:12px;">
                    &bull; Для Beget: <code>/home/${creds.hosting_login || client.beget_login || 'username'}/${clientSites[0]?.domain || 'site.ru'}/public_html/crm_backup_agent.php</code><br>
                    &bull; Для BitrixVM (сервер VPS): <code>/home/bitrix/www/crm_backup_agent.php</code>
                  </div>
                  <div style="margin-top:6px; display:flex; gap:8px;">
                    <a href="${creds.hosting_url ? creds.hosting_url + (creds.hosting_url.includes('beget') ? '/fm' : '') : 'https://cp.beget.com/fm'}" target="_blank" class="btn btn-glass" style="font-size:11.5px; padding:4px 10px;">
                      📁 Открыть файловый менеджер Beget ↗
                    </a>
                  </div>
                </div>

                <div style="margin-bottom:8px; border-top:1px solid #f1f5f9; padding-top:8px;">
                  <strong>2. Настройка Cron-задачи:</strong> В панели хостинга добавьте ежедневную задачу Cron (например, на 04:15 утра):
                  <div style="display:flex; gap:6px; margin-top:4px;">
                    <input type="text" readonly value="php -f ${creds.web_root_dir || '/home/bitrix/www'}/crm_backup_agent.php" id="inp_cron_cmd" style="flex:1; padding:6px 10px; font-family:monospace; font-size:12px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px;">
                    <button type="button" class="btn btn-glass" style="padding:6px 10px;" onclick="copyTextValue(document.getElementById('inp_cron_cmd').value, 'Команда Cron')">📋</button>
                    <a href="${creds.hosting_url ? creds.hosting_url + (creds.hosting_url.includes('beget') ? '/cron' : '') : 'https://cp.beget.com/cron'}" target="_blank" class="btn btn-glass" style="font-size:11.5px; padding:4px 10px;">
                      ⏰ Открыть Cron на Beget ↗
                    </a>
                  </div>
                </div>

                <div style="border-top:1px solid #f1f5f9; padding-top:8px;">
                  <strong>3. Автоматическая установка через SSH в 1 клик:</strong>
                  Если доступы SSH к серверу указаны выше, скрипт установится и настроит cron сам без ручных действий:
                  <div style="margin-top:8px; display:flex; gap:10px;">
                    <button type="button" onclick="autoInstallAgentViaSsh()" class="btn" style="background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#fff; font-weight:700; font-size:12.5px; padding:8px 16px;">
                      🚀 Установить агент по SSH автоматически
                    </button>
                    <button type="button" onclick="copyCurlInstaller()" class="btn btn-glass" style="font-size:12px;">
                      ⚡ Скопировать команду One-Liner (curl ... | bash)
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- SECTION 7: NOTES -->
          <div class="form-group" style="margin-bottom:24px;">
            <label style="font-size:14px; font-weight:700; color:#1e1b4b;">Заметки по инфраструктуре и особые инструкции доступа:</label>
            <textarea name="cred_notes" rows="3" class="form-control" placeholder="Особые порты, VPN, 2FA, контакты системного администратора со стороны клиента">${creds.notes || ''}</textarea>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button type="submit" class="btn btn-primary" style="padding:12px 28px; font-size:15px;">
              <span>💾</span> Сохранить все учетные записи и доступы
            </button>
          </div>
        </form>
      </div>
    ` : ''}

    <!-- TAB: BACKUPS & MONITORING -->
    ${activeTab === 'backups' ? `
      <div class="glass-panel" style="padding: 26px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:20px; font-weight:800; color:var(--text-main); margin-bottom:4px;">📦 Резервное копирование сайтов клиента</h2>
            <p style="font-size:14px; color:var(--text-secondary);">
              Мониторинг резервных копий 1С-Битрикс, прием отчетов от серверных cron-скриптов и ручная фиксация архивов
            </p>
          </div>
        </div>

        <!-- Cards for monitored sites -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px; margin-bottom:24px;">
          ${clientSites.map(s => `
            <div style="background:rgba(248,250,252,0.9); border:1px solid #e2e8f0; border-radius:14px; padding:18px; border-left: 4px solid #10b981;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <div>
                  <div style="font-size:16px; font-weight:800; color:#1e1b4b;">${s.domain}</div>
                  <div style="font-size:12px; color:#64748b;">${s.cms} (${s.cms_version}) &bull; PHP ${s.php_version}</div>
                </div>
                <span class="badge badge-success" style="font-size:11px;">В сети</span>
              </div>
              
              <div style="font-size:13px; margin-bottom:14px; color:#334155;">
                <div>Последний бэкап: <strong style="color:#10b981;">&check; ${s.last_backup?.status || 'Успешно'}</strong></div>
                <div style="color:#64748b; font-size:12px;">${s.last_backup?.date || 'Сегодня 03:15'} (${s.last_backup?.size_mb || 3840} МБ)</div>
              </div>

              <div style="display:flex; gap:8px;">
                <a href="${s.bitrix_admin_url}" target="_blank" class="btn" style="background:#dc2626; color:#fff; font-size:12px; padding:6px 12px; text-decoration:none; border-radius:8px; font-weight:700;">
                  🔑 1С-Битрикс &nearr;
                </a>
                <a href="${s.url}" target="_blank" class="btn btn-glass" style="font-size:12px; padding:6px 12px; text-decoration:none;">
                  🌐 Сайт &nearr;
                </a>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px;">
          
          <!-- Automation / Webhook info & Agent Generator -->
          <div style="background:rgba(248,250,252,0.85); border:1px solid #c7d2fe; border-radius:14px; padding:20px; border-top:3px solid #4f46e5;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
              <h3 style="font-size:16px; font-weight:800; color:#1e1b4b; display:flex; align-items:center; gap:8px; margin:0;">
                <span>🤖</span> Автоматический агент бэкапов (PHP + Cron)
              </h3>
              <div style="display:flex; gap:6px;">
                <a href="/api/client/${client.id}/backup-agent.php" download="crm_backup_agent.php" class="btn btn-primary" style="font-size:12px; padding:5px 12px;">
                  📥 Скачать агент
                </a>
                <button type="button" onclick="openBackupAgentModal()" class="btn btn-glass" style="font-size:12px; padding:5px 12px;">
                  📖 Инструкция
                </button>
              </div>
            </div>

            <p style="font-size:13px; color:#475569; margin-bottom:12px; line-height:1.5;">
              Скрипт автоматически находит свежие дампы 1С-Битрикс и MySQL, вычисляет размер и передает статус в CRM. Поместите скрипт в корень сайта или настройте авто-установку по SSH:
            </p>

            <div style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; font-size:12.5px; line-height:1.6; margin-bottom:12px;">
              <div><strong>Папка на Beget:</strong> <code>/home/${creds.hosting_login || client.beget_login || 'user'}/${clientSites[0]?.domain || 'domain.ru'}/public_html/</code></div>
              <div><strong>Папка на VPS:</strong> <code>/home/bitrix/www/</code></div>
              <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">
                <a href="${creds.hosting_url ? creds.hosting_url + (creds.hosting_url.includes('beget') ? '/fm' : '') : 'https://cp.beget.com/fm'}" target="_blank" class="btn btn-glass" style="font-size:11.5px; padding:4px 10px;">
                  📁 Файловый менеджер Beget ↗
                </a>
                <a href="${creds.hosting_url ? creds.hosting_url + (creds.hosting_url.includes('beget') ? '/cron' : '') : 'https://cp.beget.com/cron'}" target="_blank" class="btn btn-glass" style="font-size:11.5px; padding:4px 10px;">
                  ⏰ Cron на Beget ↗
                </a>
              </div>
            </div>

            <div class="form-group" style="margin-bottom:10px;">
              <label style="font-size:12px; font-weight:600; color:#475569;">Запуск через планировщик Cron (ежедневно 04:15):</label>
              <div style="display:flex; gap:6px;">
                <input type="text" id="webhook_cron_cmd" value="php -f ${creds.web_root_dir || '/home/bitrix/www'}/crm_backup_agent.php" class="form-control" readonly style="font-family:monospace; font-size:12px; background:#f1f5f9;">
                <button type="button" class="btn btn-glass" onclick="copyTextValue(document.getElementById('webhook_cron_cmd').value, 'Команда Cron')">📋</button>
              </div>
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="btn" style="flex:1; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#fff; font-size:12px; font-weight:700; padding:8px;" onclick="autoInstallAgentViaSsh()">
                🚀 Установить по SSH в 1 клик
              </button>
              <button type="button" class="btn btn-glass" style="font-size:12px; padding:8px 12px;" onclick="openSshTerminalModal()">
                🖥️ SSH-терминал
              </button>
            </div>
          </div>

          <!-- Manual Backup Record Form -->
          <div style="background:rgba(248,250,252,0.85); border:1px solid #e2e8f0; border-radius:14px; padding:20px;">
            <h3 style="font-size:16px; font-weight:700; color:#1e1b4b; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
              <span>➕</span> Зафиксировать резервную копию вручную
            </h3>
            
            <form action="/client/${client.id}/record_backup" method="POST">
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label>Сайт:</label>
                  <select name="site_domain" class="form-control">
                    ${clientSites.map(s => `<option value="${s.domain}">${s.domain}</option>`).join('')}
                    ${clientSites.length === 0 ? '<option value="site.ru">site.ru</option>' : ''}
                  </select>
                </div>
                <div class="form-group">
                  <label>Размер архива (МБ):</label>
                  <input type="number" name="size_mb" value="3840" class="form-control" required>
                </div>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label>Тип резервной копии:</label>
                  <select name="type" class="form-control">
                    <option value="full">Полный архив (Сайт + БД)</option>
                    <option value="db">Дамп базы данных (MySQL)</option>
                    <option value="files">Файловый архив (/upload/)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Статус выполнения:</label>
                  <select name="status" class="form-control">
                    <option value="Успешно">Успешно</option>
                    <option value="Предупреждение">Предупреждение</option>
                    <option value="Ошибка">Ошибка</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label>Примечание / Локация:</label>
                <input type="text" name="details" value="Штатный бэкап 1С-Битрикс в облако S3" class="form-control">
              </div>

              <button type="submit" class="btn btn-primary" style="width:100%; padding:10px;">
                <span>💾</span> Добавить запись о резервной копии
              </button>
            </form>
          </div>

        </div>

        <!-- Backups Log Table -->
        <div style="background:#fff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden;">
          <div style="padding:14px 18px; border-bottom:1px solid #e2e8f0; font-weight:700; color:#1e1b4b;">
            История бэкапов клиента (${backups.length})
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:13.5px;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0; text-align:left; color:#64748b;">
                <th style="padding:10px 14px;">Дата и время</th>
                <th style="padding:10px 14px;">Сайт</th>
                <th style="padding:10px 14px;">Тип</th>
                <th style="padding:10px 14px;">Размер</th>
                <th style="padding:10px 14px;">Статус</th>
                <th style="padding:10px 14px;">Источник</th>
              </tr>
            </thead>
            <tbody>
              ${backups.length > 0 ? backups.map(b => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:10px 14px; font-weight:600; color:#1e1b4b;">${b.date || b.created_at || 'Сегодня 03:15'}</td>
                  <td style="padding:10px 14px; font-weight:700;">${b.site || b.domain || clientSites[0]?.domain || 'Сайт клиента'}</td>
                  <td style="padding:10px 14px; color:#475569;">${b.type || 'Полный архив'}</td>
                  <td style="padding:10px 14px; font-family:monospace;">${b.size_mb ? b.size_mb + ' МБ' : '3 840 МБ'}</td>
                  <td style="padding:10px 14px;">
                    <span class="badge badge-success" style="font-size:11px;">&check; ${b.status || 'Успешно'}</span>
                  </td>
                  <td style="padding:10px 14px; color:#64748b; font-size:12px;">${b.source || 'Bitrix Cron'}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="6" style="padding:24px; text-align:center; color:#94a3b8;">
                    Архивов еще не зафиксировано
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

      </div>
    ` : ''}
  </div>

  <!-- Modal: Edit Work Log -->
  <div id="edit-work-modal" class="modal-overlay">
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title">Редактирование записи о работе</h3>
        <button type="button" class="modal-close" onclick="closeEditWorkModal()">&times;</button>
      </div>
      <form action="/client/${client.id}/edit_log_post" method="POST" id="edit-work-form">
        <input type="hidden" name="log_id" id="edit_log_id">
        <div class="form-group">
          <label>Описание работ:</label>
          <textarea name="description" id="edit_description" class="form-control" required></textarea>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="form-group">
            <label>Категория:</label>
            <select name="category" id="edit_category" class="form-control">
              <option value="dev">Разработка</option>
              <option value="admin">Администрирование</option>
              <option value="support">Техподдержка</option>
              <option value="consult">Консультации</option>
            </select>
          </div>
          <div class="form-group">
            <label>Часы:</label>
            <input type="number" step="0.5" min="0.1" name="hours" id="edit_hours" class="form-control" required>
          </div>
        </div>
        <div class="form-group">
          <label>Дата и время:</label>
          <input type="text" name="work_date" id="edit_work_date" class="form-control">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button type="button" onclick="closeEditWorkModal()" class="btn btn-glass">Отмена</button>
          <button type="submit" class="btn btn-primary">Сохранить</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal: Create Saby Act -->
  <div id="create-act-modal" class="modal-overlay">
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title">Формирование акта выполненных работ в СБИС</h3>
        <button type="button" class="modal-close" onclick="closeCreateActModal()">&times;</button>
      </div>
      <form onsubmit="submitCreateAct(event)">
        <div class="form-group">
          <label>Расчетный период (месяц):</label>
          <input type="text" id="act_month_name" value="Май 2026" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Сумма акта:</label>
          <input type="text" id="act_amount" value="${client.tariff || '38 000 ₽'}" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Договор Saby:</label>
          <input type="text" value="${client.saby_contract_number || 'АС-2024/05'}" class="form-control" readonly>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button type="button" onclick="closeCreateActModal()" class="btn btn-glass">Отмена</button>
          <button type="submit" class="btn btn-primary">Сформировать и отправить в СБИС</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Toast Box -->
  <div id="toast-box" class="toast-box">
    <span id="toast-text"></span>
  </div>

  <script>
    function showToast(msg) {
      const b = document.getElementById('toast-box');
      document.getElementById('toast-text').textContent = msg;
      b.style.display = 'flex';
      setTimeout(() => { b.style.display = 'none'; }, 3500);
    }

    function copyClientAccessLink() {
      const url = window.location.origin + '/public/client/${client.active_token || ''}';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          showToast('✓ Ссылка для клиента скопирована в буфер обмена!');
        });
      } else {
        prompt('Ссылка для клиента:', url);
      }
    }

    function togglePassVisibility(inputId) {
      const el = document.getElementById(inputId);
      if (!el) return;
      el.type = el.type === 'password' ? 'text' : 'password';
    }

    function copyTextValue(val, label) {
      if (!val) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(val).then(() => {
          showToast('✓ ' + (label || 'Значение') + ' скопировано в буфер!');
        });
      } else {
        prompt('Скопируйте:', val);
      }
    }

    // Bidirectional Saby Sync Trigger
    async function triggerSabySync(clientId) {
      const btn = document.getElementById('sync-top-btn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span><span>Синхронизация...</span>';
      }
      try {
        const res = await fetch('/api/client/' + clientId + '/sync_saby', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          showToast('✓ Двусторонняя синхронизация завершена: ' + data.message);
          setTimeout(() => { window.location.reload(); }, 1200);
        } else {
          alert('Ошибка синхронизации: ' + (data.error || 'Неизвестная ошибка'));
        }
      } catch (e) {
        alert('Ошибка связи с сервером Saby');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>🔄</span><span>Синхронизировать с Saby</span>';
        }
      }
    }

    // Quick Add Work Modal
    function openAddWorkModal() {
      const el = document.querySelector('textarea[name="description"]');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        el.focus();
      }
    }

    // Edit Work Modal
    function editWorkModal(id, desc, hours, cat, dateStr) {
      document.getElementById('edit_log_id').value = id;
      document.getElementById('edit_description').value = desc;
      document.getElementById('edit_hours').value = hours;
      document.getElementById('edit_category').value = cat || 'support';
      document.getElementById('edit_work_date').value = dateStr || '';
      document.getElementById('edit-work-modal').style.display = 'flex';
    }
    function closeEditWorkModal() {
      document.getElementById('edit-work-modal').style.display = 'none';
    }

    // Create Act Modal
    function openCreateActModal() {
      document.getElementById('create-act-modal').style.display = 'flex';
    }
    function closeCreateActModal() {
      document.getElementById('create-act-modal').style.display = 'none';
    }
    async function submitCreateAct(e) {
      e.preventDefault();
      const month = document.getElementById('act_month_name').value;
      const amount = document.getElementById('act_amount').value;
      const res = await fetch('/api/saby_act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: ${client.id}, monthName: month, amount: amount })
      });
      const data = await res.json();
      if (data.ok) {
        closeCreateActModal();
        showToast('✓ Акт ' + data.doc.number + ' успешно сформирован и отправлен в СБИС ЭДО!');
        setTimeout(() => { window.location.reload(); }, 1200);
      }
    }

    // Auto INN lookup in settings
    let suggestTimer = null;
    function autoLookupInn(val) {
      clearTimeout(suggestTimer);
      const box = document.getElementById('settings-suggest-box');
      if (!val || val.length < 3) {
        if (box) box.style.display = 'none';
        return;
      }
      suggestTimer = setTimeout(() => {
        fetch('/suggest_company?q=' + encodeURIComponent(val))
          .then(r => r.json())
          .then(items => {
            if (!box) return;
            box.innerHTML = '';
            if (items && items.length > 0) {
              box.style.display = 'block';
              items.forEach(c => {
                const item = document.createElement('div');
                item.className = 'suggest-item';
                item.innerHTML = '<strong>' + c.name + '</strong> (ИНН: ' + c.inn + ')' +
                  (c.address ? '<small>' + c.address + '</small>' : '');
                item.onclick = () => {
                  applyCompanyData(c);
                  box.style.display = 'none';
                };
                box.appendChild(item);
              });
            } else {
              box.style.display = 'none';
            }
          });
      }, 250);
    }

    function applyCompanyData(c) {
      document.getElementById('setting_inn').value = c.inn;
      document.getElementById('setting_company_name').value = c.name;
      if (c.kpp) document.getElementById('setting_kpp').value = c.kpp;
      if (c.ogrn) document.getElementById('setting_ogrn').value = c.ogrn;
      if (c.director) document.getElementById('setting_director').value = c.director;
      if (c.address) document.getElementById('setting_address').value = c.address;
      if (c.sites) document.getElementById('setting_sites').value = c.sites;
      if (c.email) document.getElementById('setting_emails').value = c.email;
      loadContractsForInn(c.inn);
      showToast('✓ Данные ' + c.name + ' подтянуты из Saby');
    }

    function loadContractsForInn(inn) {
      fetch('/get_contracts?inn=' + encodeURIComponent(inn))
        .then(r => r.json())
        .then(data => {
          const sel = document.getElementById('setting_contract_select');
          if (!sel) return;
          sel.innerHTML = '';
          if (data.contracts && data.contracts.length > 0) {
            data.contracts.forEach(cnt => {
              const opt = document.createElement('option');
              opt.value = cnt.id + '|||' + cnt.number + '|||' + cnt.title + '|||' + (cnt.plan_hours || 15) + '|||' + (cnt.tariff || '38 000 ₽ / мес');
              opt.textContent = cnt.number + ' — ' + cnt.title + ' (' + (cnt.plan_hours || 15) + ' ч/мес, ' + (cnt.tariff || '') + ')';
              sel.appendChild(opt);
            });
            onContractSelectChange(sel);
          }
        });
    }

    function reloadContractsForClient() {
      const inn = document.getElementById('setting_inn').value;
      loadContractsForInn(inn);
      showToast('✓ Список договоров обновлен из Saby');
    }

    function onContractSelectChange(sel) {
      const val = sel.value;
      const parts = val.split('|||');
      document.getElementById('setting_contract_id').value = parts[0] || '';
      document.getElementById('setting_contract_number').value = parts[1] || '';
      document.getElementById('setting_contract_title').value = parts[2] || '';
      if (parts[3]) document.getElementById('setting_plan_hours').value = parts[3];
      if (parts[4]) document.getElementById('setting_tariff').value = parts[4];
    }

    // Filter Dates in Report Tab
    function setFilterDates(type) {
      const now = new Date();
      if (type === 'this_month') {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        document.getElementById('report_date_from').value = from.toISOString().slice(0, 10);
        document.getElementById('report_date_to').value = now.toISOString().slice(0, 10);
      } else if (type === 'prev_month') {
        const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const to = new Date(now.getFullYear(), now.getMonth(), 0);
        document.getElementById('report_date_from').value = from.toISOString().slice(0, 10);
        document.getElementById('report_date_to').value = to.toISOString().slice(0, 10);
      } else if (type === '7_days') {
        const from = new Date(now.getTime() - 7 * 86400000);
        document.getElementById('report_date_from').value = from.toISOString().slice(0, 10);
        document.getElementById('report_date_to').value = now.toISOString().slice(0, 10);
      }
    }

    // --- GitHub & CI/CD Synchronization ---
    function openGitHubModal() {
      document.getElementById('admin-gh-modal').style.display = 'flex';
    }

    function closeGitHubModal() {
      document.getElementById('admin-gh-modal').style.display = 'none';
    }

    async function executeGitHubPush() {
      const msg = document.getElementById('gh-commit-msg').value || 'Синхронизация состояния CRM';
      const box = document.getElementById('gh-result-box');
      const btn = document.getElementById('gh-push-btn');
      btn.disabled = true;
      btn.textContent = '⏳ Выполняется push...';
      box.style.display = 'block';
      box.style.background = '#eff6ff';
      box.style.color = '#1e3a8a';
      box.textContent = 'Индексация, создание снимка базы данных и отправка в репозиторий GitHub...';

      try {
        const res = await fetch('/api/github/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        if (data.ok) {
          box.style.background = '#ecfdf5';
          box.style.color = '#065f46';
          box.textContent = '✓ ' + (data.log?.message || 'Успешно отправлено на GitHub!');
          showToast('✓ ' + (data.log?.message || 'Синхронизировано с GitHub'));
        } else {
          box.style.background = '#fef2f2';
          box.style.color = '#991b1b';
          box.textContent = 'Ошибка: ' + (data.log?.message || data.error);
        }
      } catch (e) {
        box.style.background = '#fef2f2';
        box.style.color = '#991b1b';
        box.textContent = 'Сетевая ошибка: ' + e.message;
      } finally {
        btn.disabled = false;
        btn.textContent = '🚀 Запустить Git Commit & Push на GitHub';
      }
    }

    async function testGitHubConnection() {
      const box = document.getElementById('gh-result-box');
      box.style.display = 'block';
      box.style.background = '#eff6ff';
      box.style.color = '#1e3a8a';
      box.textContent = 'Проверка токена и прав доступа через GitHub API...';

      try {
        const res = await fetch('/api/github/test', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          box.style.background = '#ecfdf5';
          box.style.color = '#065f46';
          box.textContent = '✓ ' + data.message + (data.repo?.canPush ? ' (Права на запись: ДА)' : '');
        } else {
          box.style.background = '#fffbeb';
          box.style.color = '#92400e';
          box.textContent = 'Статус: ' + data.message;
        }
      } catch (e) {
        box.style.background = '#fef2f2';
        box.style.color = '#991b1b';
        box.textContent = 'Сетевая ошибка: ' + e.message;
      }
    }

    // --- Saby RPC Test ---
    async function testSabyRPC() {
      showToast('⚡ Проверка шлюза Saby RPC...');
      try {
        const res = await fetch('/api/saby/test');
        const data = await res.json();
        if (data.ok) {
          alert('✓ Saby RPC Статус: ' + data.message);
        } else {
          alert('⚠️ Saby RPC: ' + data.message + '\\n\\nДля подключения боевого шлюза укажите SABY_APP_CLIENT_ID и SABY_SECRET_KEY.');
        }
      } catch (e) {
        alert('Ошибка связи: ' + e.message);
      }
    }

    // --- Live Beget API Refresh ---
    async function refreshBegetData(clientId) {
      showToast('🌐 Запрос данных с серверов Beget Cloud...');
      try {
        const res = await fetch('/api/beget/refresh/' + clientId, { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          showToast('✓ ' + data.message);
          setTimeout(() => { window.location.reload(); }, 1200);
        } else {
          alert('Beget API: ' + data.message);
        }
      } catch (e) {
        alert('Ошибка связи с сервером: ' + e.message);
      }
    }

    // --- Contact & 2FA Access Management ---
    function openAddContactModal() {
      document.getElementById('add-contact-modal').style.display = 'flex';
    }

    function closeAddContactModal() {
      document.getElementById('add-contact-modal').style.display = 'none';
    }

    function copyContactLink(contactId, token) {
      const input = document.getElementById('link-input-' + contactId);
      let url = input ? input.value : (window.location.origin + '/portal?token=' + token);
      if (url.startsWith('/')) {
        url = window.location.origin + url;
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          showToast('✓ Секретная ссылка контакта скопирована!');
        });
      } else {
        prompt('Секретная ссылка контакта:', url);
      }
    }

    async function sendContactInvite(clientId, contactId, email) {
      if (!confirm('Выслать персональное приглашение и ссылку доступа на почту ' + email + '?')) return;
      showToast('✉️ Отправка приглашения через почтовый шлюз...');
      try {
        const res = await fetch('/api/client/' + clientId + '/contact/' + contactId + '/send_invite', {
          method: 'POST'
        });
        const data = await res.json();
        if (data.ok) {
          showToast('✓ Приглашение успешно отправлено на ' + email);
          alert('✓ Приглашение со ссылкой и инструкцией успешно отправлено сотруднику на ' + email + (data.simulated ? '\\n(Использован безопасный режим эмуляции, проверьте логи сервера)' : ''));
        } else {
          alert('Ошибка отправки: ' + (data.error || 'Неизвестная ошибка'));
        }
      } catch (err) {
        alert('Ошибка связи: ' + err.message);
      }
    }

    // --- Interactive KPI Modals ---
    function openKpiHoursModal() {
      document.getElementById('kpi-hours-modal').style.display = 'flex';
    }
    function closeKpiHoursModal() {
      document.getElementById('kpi-hours-modal').style.display = 'none';
    }

    function openKpiSabyModal() {
      document.getElementById('kpi-saby-modal').style.display = 'flex';
    }
    function closeKpiSabyModal() {
      document.getElementById('kpi-saby-modal').style.display = 'none';
    }

    function openKpiBackupModal() {
      document.getElementById('kpi-backup-modal').style.display = 'flex';
    }
    function closeKpiBackupModal() {
      document.getElementById('kpi-backup-modal').style.display = 'none';
    }

    // --- In-Browser SSH Terminal ---
    function openSshTerminalModal() {
      const modal = document.getElementById('ssh-terminal-modal');
      if (!modal) return;
      modal.style.display = 'flex';
      const term = document.getElementById('ssh-term-output');
      if (term && term.dataset.initialized !== 'true') {
        term.dataset.initialized = 'true';
        term.innerHTML = '<div style="color:#64748b;">[Web-SSH Terminal инициализирован]</div>' +
          '<div style="color:#38bdf8;">Подключение к ${creds.ssh_user || "root"}@${creds.ssh_host || "localhost"}:${creds.ssh_port || 22}...</div>' +
          '<div style="color:#10b981;">✓ Готово. Введите команду Linux или выберите быстрые команды ниже.</div><br>';
      }
      setTimeout(() => {
        const inp = document.getElementById('ssh-term-input');
        if (inp) inp.focus();
      }, 100);
    }

    function closeSshTerminalModal() {
      const modal = document.getElementById('ssh-terminal-modal');
      if (modal) modal.style.display = 'none';
    }

    function clearTerminal() {
      const term = document.getElementById('ssh-term-output');
      if (term) term.innerHTML = '<div style="color:#64748b;">[Терминал очищен]</div>';
    }

    async function sendTerminalCmd(e) {
      if (e) e.preventDefault();
      const inp = document.getElementById('ssh-term-input');
      const term = document.getElementById('ssh-term-output');
      if (!inp || !inp.value.trim()) return;
      const cmd = inp.value.trim();
      inp.value = '';
      await runQuickSshCmd(cmd);
    }

    async function runQuickSshCmd(cmd) {
      const term = document.getElementById('ssh-term-output');
      if (!term) return;
      const ts = new Date().toLocaleTimeString('ru-RU');
      term.innerHTML += '<div style="margin-top:6px; color:#94a3b8;"><span style="color:#38bdf8; font-weight:700;">root@server</span>:<span style="color:#a855f7;">~</span># ' + escapeHtml(cmd) + ' <span style="font-size:10px; color:#64748b; float:right;">' + ts + '</span></div>';
      term.scrollTop = term.scrollHeight;

      try {
        const res = await fetch('/api/client/${client.id}/ssh/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd })
        });
        const data = await res.json();
        if (data.ok) {
          const out = data.stdout || data.output || '(Команда выполнена успешно, без вывода)';
          term.innerHTML += '<div style="color:#f1f5f9; white-space:pre-wrap; margin:4px 0 10px; font-family:monospace; line-height:1.4;">' + escapeHtml(out) + '</div>';
          if (data.stderr) {
            term.innerHTML += '<div style="color:#f87171; white-space:pre-wrap; margin:2px 0 8px; font-family:monospace;">' + escapeHtml(data.stderr) + '</div>';
          }
        } else {
          term.innerHTML += '<div style="color:#f87171; white-space:pre-wrap; margin:4px 0 8px; font-family:monospace;">Ошибка: ' + escapeHtml(data.error || 'Сбой выполнения') + '</div>';
        }
      } catch (err) {
        term.innerHTML += '<div style="color:#f87171; margin:4px 0 8px; font-family:monospace;">Сетевой сбой: ' + escapeHtml(err.message) + '</div>';
      }
      term.scrollTop = term.scrollHeight;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // --- SSH Test & Auto Install Agent ---
    async function testSshConnection() {
      showToast('⚡ Проверка подключения по SSH...');
      try {
        const res = await fetch('/api/client/${client.id}/ssh/test', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          alert('✓ Связь по SSH установлена!\\n\\n' +
            'Хост: ' + data.host + ':' + data.port + '\\n' +
            'Пользователь: ' + data.user + '\\n' +
            'ОС: ' + (data.os || 'Linux') + '\\n' +
            'Uptime: ' + (data.uptime || 'OK'));
          showToast('✓ SSH соединение успешно');
        } else {
          alert('⚠️ Ошибка подключения по SSH:\\n\\n' + data.error + '\\n\\nПроверьте хост, порт, логин и пароль/ключ во вкладке Доступы.');
        }
      } catch (err) {
        alert('Ошибка связи с сервером CRM: ' + err.message);
      }
    }

    async function autoInstallAgentViaSsh() {
      if (!confirm('Автоматически подключиться по SSH к серверу клиента, создать скрипт crm_backup_agent.php и добавить задачу в планировщик cron?')) return;
      showToast('🚀 Установка агента авто-бэкапов через SSH...');
      try {
        const res = await fetch('/api/client/${client.id}/ssh/install-agent', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          alert('✓ Агент авто-бэкапов успешно развернут на сервере!\\n\\n' +
            'Файл: ' + data.path + '\\n' +
            'Cron задача: ' + (data.cron_installed ? 'Добавлена в crontab' : 'Требует проверки') + '\\n\\n' +
            'Результат:\\n' + (data.output || 'OK'));
          showToast('✓ Агент авто-бэкапов установлен на сервер');
          setTimeout(() => { window.location.reload(); }, 1500);
        } else {
          alert('⚠️ Ошибка автоматической установки:\\n\\n' + data.error + '\\n\\nПопробуйте скачать скрипт вручную или проверить настройки SSH.');
        }
      } catch (err) {
        alert('Ошибка связи: ' + err.message);
      }
    }

    // --- Backup Agent Modal ---
    function openBackupAgentModal() {
      const modal = document.getElementById('backup-agent-modal');
      if (modal) modal.style.display = 'flex';
    }
    function closeBackupAgentModal() {
      const modal = document.getElementById('backup-agent-modal');
      if (modal) modal.style.display = 'none';
    }

    async function copyBackupAgentCode() {
      try {
        const res = await fetch('/api/client/${client.id}/backup-agent.php');
        const code = await res.text();
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(code);
          showToast('✓ PHP-код скрипта crm_backup_agent.php скопирован!');
        } else {
          prompt('Код скрипта crm_backup_agent.php:', code);
        }
      } catch (err) {
        showToast('Ошибка загрузки скрипта');
      }
    }

    function copyCurlInstaller() {
      const host = window.location.origin;
      const cmd = 'curl -sSL ' + host + '/api/client/${client.id}/install-agent.sh | bash';
      copyTextValue(cmd, 'Команда One-Liner (curl | bash)');
    }

    function openFtpClient() {
      const host = document.getElementById('inp_ftp_host')?.value || document.getElementById('inp_ssh_host')?.value || '';
      const port = document.getElementById('inp_ftp_port')?.value || '21';
      const user = document.getElementById('inp_ftp_user')?.value || '';
      const pass = document.getElementById('inp_ftp_pass')?.value || '';
      if (!host) {
        alert('Укажите FTP хост во вкладке «Доступы»');
        return;
      }
      const uri = 'ftp://' + encodeURIComponent(user) + ':' + encodeURIComponent(pass) + '@' + host + ':' + port + '/';
      window.location.href = uri;
      showToast('Открытие FTP-клиента...');
    }

    function copyFtpParams() {
      const host = document.getElementById('inp_ftp_host')?.value || document.getElementById('inp_ssh_host')?.value || '';
      const port = document.getElementById('inp_ftp_port')?.value || '21';
      const user = document.getElementById('inp_ftp_user')?.value || '';
      const pass = document.getElementById('inp_ftp_pass')?.value || '';
      const text = 'Хост: ' + host + '\\nПорт: ' + port + '\\nПользователь: ' + user + '\\nПароль: ' + pass;
      copyTextValue(text, 'Параметры FTP подключения');
    }
  </script>

  <!-- Add Contact Modal -->
  <div id="add-contact-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.5); backdrop-filter:blur(4px); align-items:center; justify-content:center; z-index:2000; padding:20px;">
    <div style="background:#ffffff; border-radius:18px; max-width:540px; width:100%; padding:26px; box-shadow:0 24px 60px rgba(0,0,0,0.25);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid #e2e8f0;">
        <h3 style="margin:0; font-size:18px; font-weight:800; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
          <span>👤</span> Новое контактное лицо клиента
        </h3>
        <button type="button" onclick="closeAddContactModal()" style="background:transparent; border:none; font-size:24px; cursor:pointer; color:#94a3b8;">&times;</button>
      </div>

      <p style="font-size:13px; color:#64748b; margin-bottom:16px; line-height:1.5;">
        Для сотрудника будет автоматически сгенерирован индивидуальный токен. При каждом входе в личный кабинет на его email будет отправляться 6-значный 2FA-код.
      </p>

      <form action="/client/${client.id}/contacts/add" method="POST">
        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:12.5px; font-weight:700; color:#334155; margin-bottom:4px;">ФИО сотрудника *</label>
          <input type="text" name="name" required placeholder="Иванов Иван Иванович" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13.5px;">
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:12.5px; font-weight:700; color:#334155; margin-bottom:4px;">Должность</label>
          <input type="text" name="position" placeholder="Генеральный директор / Главный бухгалтер / IT-директор" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13.5px;">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="display:block; font-size:12.5px; font-weight:700; color:#334155; margin-bottom:4px;">Рабочая почта (для 2FA) *</label>
            <input type="email" name="email" required placeholder="employee@company.ru" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13.5px;">
          </div>
          <div>
            <label style="display:block; font-size:12.5px; font-weight:700; color:#334155; margin-bottom:4px;">Телефон</label>
            <input type="tel" name="phone" placeholder="+7 (999) 000-00-00" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13.5px;">
          </div>
        </div>

        <div style="margin-bottom:18px;">
          <label style="display:block; font-size:12.5px; font-weight:700; color:#334155; margin-bottom:4px;">Уровень доступа</label>
          <select name="role" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13.5px; background:#fff;">
            <option value="full">Полный доступ (акты СБИС, подача заявок, мониторинг)</option>
            <option value="technical">Технический доступ (подача заявок и мониторинг сайтов)</option>
            <option value="financial">Финансовый доступ (акты СБИС, договоры и счета)</option>
          </select>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button type="button" onclick="closeAddContactModal()" class="btn btn-glass" style="padding:9px 16px;">Отмена</button>
          <button type="submit" class="btn btn-primary" style="padding:9px 20px;">
            <span>+</span> Добавить и выпустить ссылку
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- GitHub Sync & CI/CD Modal -->
  <div id="admin-gh-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.5); backdrop-filter:blur(4px); align-items:center; justify-content:center; z-index:2000; padding:20px;">
    <div style="background:#ffffff; border-radius:18px; max-width:600px; width:100%; padding:26px; box-shadow:0 24px 60px rgba(0,0,0,0.25);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; padding-bottom:12px; border-bottom:1px solid #e2e8f0;">
        <h3 style="margin:0; font-size:18px; font-weight:800; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
          <span>🐙</span> Синхронизация с GitHub (EKlimov84/crm-beget-saby)
        </h3>
        <button type="button" onclick="closeGitHubModal()" style="background:transparent; border:none; font-size:24px; cursor:pointer; color:#94a3b8;">&times;</button>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; font-size:13.5px; line-height:1.6; margin-bottom:16px;">
        <div><strong>Ветка:</strong> <code>main</code> &bull; <strong>Репозиторий:</strong> <code>EKlimov84/crm-beget-saby</code></div>
        <div><strong>CI/CD Workflow:</strong> <code>.github/workflows/deploy.yml</code> (автоматический деплой)</div>
        <div style="font-size:12px; color:#64748b; margin-top:4px;">
          При синхронизации создаётся коммит состояния CRM и базы данных, отправляется в origin/main и запускает деплой на сервер.
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <label style="display:block; font-size:13px; font-weight:700; color:#334155; margin-bottom:6px;">Комментарий к коммиту:</label>
        <input type="text" id="gh-commit-msg" value="Обновление данных контрагента ${client.company_name}" style="width:100%; box-sizing:border-box; padding:10px 14px; border:1px solid #cbd5e1; border-radius:10px; font-size:14px;">
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;">
        <button type="button" id="gh-push-btn" onclick="executeGitHubPush()" class="btn btn-primary" style="padding:10px 20px;">
          <span>🚀</span> Запустить Git Commit & Push на GitHub
        </button>
        <button type="button" onclick="testGitHubConnection()" class="btn btn-glass" style="padding:10px 16px;">
          🔍 Тест GitHub API
        </button>
      </div>

      <div id="gh-result-box" style="display:none; padding:12px; border-radius:10px; font-size:13px; line-height:1.4;"></div>
    </div>
  </div>

  <!-- MODAL: KPI Hours Breakdown -->
  <div id="kpi-hours-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); backdrop-filter:blur(5px); align-items:center; justify-content:center; z-index:2000; padding:20px;">
    <div style="background:#ffffff; border-radius:20px; max-width:620px; width:100%; padding:26px; box-shadow:0 24px 60px rgba(0,0,0,0.25);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #e2e8f0;">
        <h3 style="margin:0; font-size:18px; font-weight:800; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
          <span>⏱️</span> Баланс и лимит часов по договору
        </h3>
        <button type="button" onclick="closeKpiHoursModal()" style="background:transparent; border:none; font-size:24px; cursor:pointer; color:#94a3b8;">&times;</button>
      </div>

      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:20px;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:12px; color:#64748b; font-weight:600;">Лимит по договору</div>
          <div style="font-size:22px; font-weight:800; color:#1e1b4b; margin-top:2px;">${planHours} ч</div>
          <div style="font-size:11px; color:#7c3aed; font-weight:600;">${client.tariff || '38 000 ₽ / мес'}</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:12px; color:#64748b; font-weight:600;">Израсходовано</div>
          <div style="font-size:22px; font-weight:800; color:#d97706; margin-top:2px;">${totalHoursUsed.toFixed(1)} ч</div>
          <div style="font-size:11px; color:#64748b;">${logs.length} выполненных задач</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:12px; color:#64748b; font-weight:600;">Остаток часов</div>
          <div style="font-size:22px; font-weight:800; color:#059669; margin-top:2px;">${hoursLeft} ч</div>
          <div style="font-size:11px; color:#059669; font-weight:700;">${percentUsed}% израсходовано</div>
        </div>
      </div>

      <div style="margin-bottom:18px;">
        <h4 style="font-size:13.5px; font-weight:700; color:#1e1b4b; margin-bottom:8px;">Последние задачи за период:</h4>
        <div style="max-height:220px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:10px;">
          <table style="width:100%; border-collapse:collapse; font-size:12.5px;">
            <tbody>
              ${logs.slice(0, 6).map(l => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:8px 12px; color:#64748b; white-space:nowrap;">${formatDateRus(l.work_date)}</td>
                  <td style="padding:8px 12px; font-weight:600; color:#1e1b4b;">${l.description}</td>
                  <td style="padding:8px 12px; font-weight:700; text-align:right; white-space:nowrap; color:#6d28d9;">${parseFloat(l.hours).toFixed(1)} ч</td>
                </tr>
              `).join('')}
              ${logs.length === 0 ? '<tr><td colspan="3" style="padding:20px; text-align:center; color:#94a3b8;">Задач пока нет</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center;">
        <button type="button" onclick="closeKpiHoursModal(); openAddWorkModal();" class="btn btn-primary" style="font-size:13px; padding:9px 18px;">
          <span>+</span> Добавить работу
        </button>
        <a href="?tab=settings" class="btn btn-glass" style="font-size:13px; padding:9px 18px;">
          <span>⚙️</span> Настройки тарифа и договора
        </a>
      </div>
    </div>
  </div>

  <!-- MODAL: KPI Saby Status -->
  <div id="kpi-saby-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); backdrop-filter:blur(5px); align-items:center; justify-content:center; z-index:2000; padding:20px;">
    <div style="background:#ffffff; border-radius:20px; max-width:580px; width:100%; padding:26px; box-shadow:0 24px 60px rgba(0,0,0,0.25);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #e2e8f0;">
        <h3 style="margin:0; font-size:18px; font-weight:800; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
          <span>⚡</span> Интеграция с Saby (СБИС) и документооборот
        </h3>
        <button type="button" onclick="closeKpiSabyModal()" style="background:transparent; border:none; font-size:24px; cursor:pointer; color:#94a3b8;">&times;</button>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; font-size:13.5px; line-height:1.6; margin-bottom:18px;">
        <div><strong>Контрагент:</strong> ${client.company_name}</div>
        <div><strong>ИНН / КПП:</strong> ${client.inn || 'Не указан'} / ${client.kpp || '—'}</div>
        <div><strong>Договор в Saby:</strong> <strong>${client.saby_contract_number || 'АС-2024/05'}</strong></div>
        <div><strong>Статус шлюза:</strong> <span style="color:#059669; font-weight:700;">✓ Шлюз подключен (2-way sync)</span></div>
        <div><strong>Сформировано документов:</strong> ${sabyDocs.length} актов / счетов</div>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px;">
        <button type="button" onclick="closeKpiSabyModal(); triggerSabySync(${client.id});" class="btn btn-primary" style="flex:1; font-size:13px; padding:10px;">
          <span>🔄</span> Запустить синхронизацию
        </button>
        <button type="button" onclick="testSabyRPC()" class="btn btn-glass" style="font-size:13px; padding:10px 14px;">
          <span>⚡</span> Тест шлюза
        </button>
        <button type="button" onclick="closeKpiSabyModal(); openCreateActModal();" class="btn btn-glass" style="font-size:13px; padding:10px 14px;">
          <span>📑</span> Создать акт
        </button>
      </div>

      <div style="text-align:right;">
        <a href="?tab=saby_sync" class="btn btn-glass" style="font-size:12.5px;">Перейти в раздел Saby &nearr;</a>
      </div>
    </div>
  </div>

  <!-- MODAL: KPI Backup & Cloud Status -->
  <div id="kpi-backup-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); backdrop-filter:blur(5px); align-items:center; justify-content:center; z-index:2000; padding:20px;">
    <div style="background:#ffffff; border-radius:20px; max-width:620px; width:100%; padding:26px; box-shadow:0 24px 60px rgba(0,0,0,0.25);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #e2e8f0;">
        <h3 style="margin:0; font-size:18px; font-weight:800; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
          <span>☁️</span> Мониторинг бэкапов и инфраструктуры Beget
        </h3>
        <button type="button" onclick="closeKpiBackupModal()" style="background:transparent; border:none; font-size:24px; cursor:pointer; color:#94a3b8;">&times;</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:18px;">
        ${clientSites.map(s => `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:700; color:#1e1b4b; font-size:14px;">${s.domain}</div>
              <div style="font-size:12px; color:#64748b;">${s.cms} &bull; PHP ${s.php_version}</div>
            </div>
            <div style="text-align:right;">
              <span class="badge badge-success" style="font-size:11px;">✓ ${s.last_backup?.status || 'Успешно'}</span>
              <div style="font-size:11.5px; color:#64748b; margin-top:2px;">${s.last_backup?.date || 'Сегодня 03:15'} (${s.last_backup?.size_mb || 3840} МБ)</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:space-between; align-items:center;">
        <div style="display:flex; gap:8px;">
          <a href="?tab=backups" class="btn btn-primary" style="font-size:13px; padding:9px 16px;">
            <span>📦</span> Все бэкапы (${backups.length})
          </a>
          <button type="button" onclick="closeKpiBackupModal(); openBackupAgentModal();" class="btn btn-glass" style="font-size:13px; padding:9px 14px;">
            <span>🤖</span> Агент скриптов
          </button>
        </div>
        <a href="${creds.hosting_url || 'https://cp.beget.com'}" target="_blank" class="btn btn-glass" style="font-size:13px; padding:9px 14px;">
          <span>🌐</span> Beget Cloud ↗
        </a>
      </div>
    </div>
  </div>

  <!-- MODAL: IN-BROWSER SSH TERMINAL -->
  <div id="ssh-terminal-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.75); backdrop-filter:blur(8px); align-items:center; justify-content:center; z-index:2500; padding:20px;">
    <div style="background:#090d16; border:1px solid #1e293b; border-radius:18px; max-width:860px; width:100%; box-shadow:0 30px 80px rgba(0,0,0,0.6); display:flex; flex-direction:column; overflow:hidden; height:85vh; max-height:640px;">
      
      <!-- Terminal Window Header (Mac Style) -->
      <div style="background:#0f172a; padding:12px 18px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="width:12px; height:12px; border-radius:50%; background:#ef4444; display:inline-block; cursor:pointer;" onclick="closeSshTerminalModal()" title="Закрыть"></span>
          <span style="width:12px; height:12px; border-radius:50%; background:#f59e0b; display:inline-block; cursor:pointer;" onclick="clearTerminal()" title="Очистить экран"></span>
          <span style="width:12px; height:12px; border-radius:50%; background:#10b981; display:inline-block;" title="Активно"></span>
          <span style="color:#94a3b8; font-family:monospace; font-size:13px; margin-left:12px;">
            ${creds.ssh_user || 'root'}@${creds.ssh_host || 'localhost'}:${creds.ssh_port || 22} (${client.company_name})
          </span>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" onclick="clearTerminal()" style="background:transparent; border:1px solid #334155; color:#94a3b8; padding:3px 10px; border-radius:6px; font-size:11.5px; font-family:monospace; cursor:pointer;">
            Clear
          </button>
          <button type="button" onclick="closeSshTerminalModal()" style="background:transparent; border:none; color:#94a3b8; font-size:20px; line-height:1; cursor:pointer;">&times;</button>
        </div>
      </div>

      <!-- Terminal Output Screen -->
      <div id="ssh-term-output" style="flex:1; padding:16px 20px; overflow-y:auto; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size:13px; line-height:1.55; color:#e2e8f0; background:#070b12;">
        <div style="color:#64748b;">[Web-SSH Terminal инициализирован]</div>
        <div style="color:#38bdf8;">Подключение к ${creds.ssh_user || 'root'}@${creds.ssh_host || 'localhost'}:${creds.ssh_port || 22}...</div>
        <div style="color:#10b981;">✓ Готово. Введите команду Linux или выберите быстрые команды ниже.</div>
      </div>

      <!-- Quick Command Buttons Bar -->
      <div style="background:#0b1120; border-top:1px solid #1e293b; padding:8px 16px; display:flex; gap:6px; overflow-x:auto; white-space:nowrap;">
        <button type="button" onclick="runQuickSshCmd('uptime')" style="background:#1e293b; color:#38bdf8; border:none; padding:4px 10px; border-radius:6px; font-size:11.5px; font-family:monospace; cursor:pointer;">uptime</button>
        <button type="button" onclick="runQuickSshCmd('free -h')" style="background:#1e293b; color:#38bdf8; border:none; padding:4px 10px; border-radius:6px; font-size:11.5px; font-family:monospace; cursor:pointer;">free -h</button>
        <button type="button" onclick="runQuickSshCmd('df -h')" style="background:#1e293b; color:#38bdf8; border:none; padding:4px 10px; border-radius:6px; font-size:11.5px; font-family:monospace; cursor:pointer;">df -h</button>
        <button type="button" onclick="runQuickSshCmd('crontab -l')" style="background:#1e293b; color:#38bdf8; border:none; padding:4px 10px; border-radius:6px; font-size:11.5px; font-family:monospace; cursor:pointer;">crontab -l</button>
        <button type="button" onclick="runQuickSshCmd('ls -la ${creds.web_root_dir || '/home/bitrix/www'}')" style="background:#1e293b; color:#38bdf8; border:none; padding:4px 10px; border-radius:6px; font-size:11.5px; font-family:monospace; cursor:pointer;">ls -la web-root</button>
        <button type="button" onclick="runQuickSshCmd('php -v')" style="background:#1e293b; color:#38bdf8; border:none; padding:4px 10px; border-radius:6px; font-size:11.5px; font-family:monospace; cursor:pointer;">php -v</button>
        <button type="button" onclick="autoInstallAgentViaSsh()" style="background:#065f46; color:#a7f3d0; border:none; padding:4px 10px; border-radius:6px; font-size:11.5px; font-family:monospace; cursor:pointer; font-weight:700;">+ Развернуть агент бэкапов</button>
      </div>

      <!-- Terminal Command Input Line -->
      <form onsubmit="sendTerminalCmd(event)" style="background:#0f172a; padding:12px 18px; display:flex; gap:10px; align-items:center; border-top:1px solid #1e293b;">
        <span style="color:#10b981; font-family:monospace; font-weight:700; font-size:14px;">#</span>
        <input type="text" id="ssh-term-input" placeholder="Введите команду Linux (например: ls -la /home/bitrix/www) и нажмите Enter..." autocomplete="off" style="flex:1; background:transparent; border:none; outline:none; color:#f1f5f9; font-family:monospace; font-size:13.5px;">
        <button type="submit" style="background:#38bdf8; color:#0f172a; border:none; font-weight:700; font-size:12px; padding:6px 14px; border-radius:6px; cursor:pointer;">
          Выполнить &crarr;
        </button>
      </form>
    </div>
  </div>

  <!-- MODAL: BACKUP AGENT SCRIPT & INSTRUCTIONS -->
  <div id="backup-agent-modal" class="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(6px); align-items:center; justify-content:center; z-index:2200; padding:20px;">
    <div style="background:#ffffff; border-radius:20px; max-width:760px; width:100%; padding:26px; box-shadow:0 24px 60px rgba(0,0,0,0.25); max-height:90vh; overflow-y:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #e2e8f0;">
        <h3 style="margin:0; font-size:18px; font-weight:800; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
          <span>🤖</span> Автоматический агент бэкапов (PHP + Cron)
        </h3>
        <button type="button" onclick="closeBackupAgentModal()" style="background:transparent; border:none; font-size:24px; cursor:pointer; color:#94a3b8;">&times;</button>
      </div>

      <p style="font-size:13.5px; color:#475569; line-height:1.55; margin-bottom:16px;">
        Скрипт <code>crm_backup_agent.php</code> генерируется персонально для клиента <strong>${client.company_name}</strong> с защитным токеном авторизации. Он автоматически находит архивы 1С-Битрикс и MySQL, вычисляет размер и передает статус в CRM.
      </p>

      <!-- Quick Action Buttons -->
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:18px;">
        <a href="/api/client/${client.id}/backup-agent.php" download="crm_backup_agent.php" class="btn btn-primary" style="padding:10px 18px; font-size:13px;">
          📥 Скачать crm_backup_agent.php
        </a>
        <button type="button" onclick="copyBackupAgentCode()" class="btn btn-glass" style="padding:10px 16px; font-size:13px;">
          📋 Скопировать PHP-код в буфер
        </button>
        <button type="button" onclick="copyCurlInstaller()" class="btn btn-glass" style="padding:10px 16px; font-size:13px;">
          ⚡ Команда One-Liner (curl | bash)
        </button>
        <button type="button" onclick="closeBackupAgentModal(); autoInstallAgentViaSsh();" class="btn" style="background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#fff; font-weight:700; font-size:13px; padding:10px 16px;">
          🚀 Установить по SSH на сервер
        </button>
      </div>

      <!-- Instructions Section -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:18px; font-size:13px; line-height:1.65; margin-bottom:18px;">
        <h4 style="font-size:14.5px; font-weight:800; color:#1e1b4b; margin-bottom:10px;">Инструкция по размещению на хостинге:</h4>
        
        <div style="margin-bottom:12px;">
          <strong>Шаг 1. Разместите файл в корне сайта:</strong>
          <div style="margin:4px 0; color:#4338ca; font-family:monospace; font-size:12px;">
            &bull; Папка Beget: <code>/home/${creds.hosting_login || client.beget_login || 'login'}/${clientSites[0]?.domain || 'site.ru'}/public_html/crm_backup_agent.php</code><br>
            &bull; Папка BitrixVM: <code>/home/bitrix/www/crm_backup_agent.php</code>
          </div>
          <div style="margin-top:6px;">
            <a href="${creds.hosting_url ? creds.hosting_url + (creds.hosting_url.includes('beget') ? '/fm' : '') : 'https://cp.beget.com/fm'}" target="_blank" class="btn btn-glass" style="font-size:11.5px; padding:4px 10px;">
              📁 Открыть файловый менеджер Beget ↗
            </a>
          </div>
        </div>

        <div style="border-top:1px solid #e2e8f0; padding-top:10px; margin-bottom:12px;">
          <strong>Шаг 2. Настройте задание в Cron на хостинге:</strong>
          <div style="margin:4px 0; color:#475569;">Рекомендуемое время запуска: <strong>ежедневно в 04:15 утра</strong> (после создания ночного бэкапа Битрикса):</div>
          <div style="display:flex; gap:6px; margin-top:6px;">
            <input type="text" readonly value="php -f ${creds.web_root_dir || '/home/bitrix/www'}/crm_backup_agent.php" id="modal_cron_cmd" style="flex:1; padding:7px 10px; font-family:monospace; font-size:12px; background:#fff; border:1px solid #cbd5e1; border-radius:8px;">
            <button type="button" class="btn btn-glass" style="padding:6px 12px; font-size:12px;" onclick="copyTextValue(document.getElementById('modal_cron_cmd').value, 'Команда Cron')">📋 Скопировать</button>
            <a href="${creds.hosting_url ? creds.hosting_url + (creds.hosting_url.includes('beget') ? '/cron' : '') : 'https://cp.beget.com/cron'}" target="_blank" class="btn btn-glass" style="font-size:11.5px; padding:6px 10px;">
              ⏰ Открыть Cron на Beget ↗
            </a>
          </div>
        </div>

        <div style="border-top:1px solid #e2e8f0; padding-top:10px;">
          <strong>Шаг 3. Проверка работы:</strong>
          <div style="margin-top:4px; color:#475569;">После запуска скрипт отправит отчет в CRM по защищенному Webhook URL, и запись появится в таблице во вкладке «Бэкапы сайтов».</div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button type="button" onclick="closeBackupAgentModal()" class="btn btn-glass" style="padding:8px 20px;">Закрыть</button>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Render New Client Page in Apple Liquid Glass
export function renderNewClientPage() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Добавление контрагента из Saby | Apple Liquid Glass</title>
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 10% 20%, rgba(238, 242, 255, 0.85) 0%, rgba(245, 243, 255, 0.8) 50%, rgba(248, 250, 252, 0.95) 100%);
      --glass-bg: rgba(255, 255, 255, 0.72);
      --glass-border: rgba(255, 255, 255, 0.8);
      --glass-shadow: 0 16px 40px 0 rgba(31, 38, 135, 0.08);
      --primary: #7c3aed;
      --primary-gradient: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      --text-main: #1e1b4b;
      --text-secondary: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      background: var(--bg-gradient);
      min-height: 100vh;
      color: var(--text-main);
      padding: 40px 20px;
    }
    .container {
      max-width: 840px;
      margin: 0 auto;
    }
    .glass-card {
      background: var(--glass-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 36px;
      box-shadow: var(--glass-shadow);
    }
    .form-group {
      margin-bottom: 20px;
      position: relative;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 6px;
    }
    .form-control {
      width: 100%;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      font-size: 14px;
      color: #1e293b;
      outline: none;
      transition: all 0.2s;
    }
    .form-control:focus {
      border-color: #7c3aed;
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
    }
    .btn-submit {
      background: var(--primary-gradient);
      color: #ffffff;
      padding: 13px 28px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
      transition: all 0.2s;
    }
    .btn-submit:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4);
    }
    .suggest-box {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      box-shadow: 0 16px 36px rgba(15, 23, 42, 0.15);
      z-index: 50;
      max-height: 280px;
      overflow-y: auto;
      margin-top: 4px;
      display: none;
    }
    .suggest-item {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f1f5f9;
      transition: background 0.15s;
    }
    .suggest-item:hover { background: #f8fafc; }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" style="display:inline-flex; align-items:center; gap:8px; color:#5b21b6; font-weight:600; text-decoration:none; margin-bottom:20px;">
      &larr; Вернуться к списку контрагентов
    </a>

    <div class="glass-card">
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:24px;">
        <div style="width:48px; height:48px; border-radius:14px; background:var(--primary-gradient); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px;">
          ✨
        </div>
        <div>
          <h1 style="font-size:24px; font-weight:800; color:var(--text-main);">Добавление контрагента из Saby</h1>
          <p style="font-size:14px; color:var(--text-secondary); margin-top:2px;">
            Введите ИНН организации — наименование, реквизиты и действующие договоры подтянутся автоматически
          </p>
        </div>
      </div>

      <form action="/add_client" method="POST" id="new-client-form">
        <input type="hidden" id="inn" name="inn">
        <input type="hidden" id="company_name" name="company_name">
        <input type="hidden" id="contract_id" name="contract_id">
        <input type="hidden" id="contract_number" name="contract_number">

        <div class="form-group">
          <label>Поиск организации по ИНН или названию:</label>
          <input type="text" id="search_input" class="form-control" placeholder="Введите ИНН (например, 7707083893) или наименование компании..." oninput="searchCompany(this.value)" autocomplete="off" required>
          <div id="suggest-box" class="suggest-box"></div>
          <small style="display:block; font-size:12px; color:#64748b; margin-top:6px;">
            Поддерживается автоматический поиск по 10 или 12 цифрам ИНН и базе Saby/ЕГРЮЛ.
          </small>
        </div>

        <div class="form-group">
          <label>Договор из Saby:</label>
          <select id="contract_select" class="form-control" onchange="onContractChange()">
            <option value="">Сначала укажите ИНН организации выше</option>
          </select>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
          <div class="form-group">
            <label>Обслуживаемые сайты:</label>
            <input type="text" id="sites_input" name="sites" class="form-control" placeholder="company-site.ru, shop.company-site.ru">
          </div>
          <div class="form-group">
            <label>Email для регламентных отчётов:</label>
            <input type="email" id="email_input" name="emails" class="form-control" placeholder="info@company.ru">
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:14px; margin-top:28px;">
          <a href="/" style="padding:12px 20px; font-weight:600; color:#64748b; text-decoration:none; display:inline-flex; align-items:center;">Отмена</a>
          <button type="submit" class="btn-submit">
            ✨ Создать карточку и подключить Saby
          </button>
        </div>
      </form>
    </div>
  </div>

  <script>
    let searchTimer = null;
    function searchCompany(val) {
      clearTimeout(searchTimer);
      const box = document.getElementById('suggest-box');
      if (!val || val.length < 2) {
        box.style.display = 'none';
        return;
      }
      searchTimer = setTimeout(() => {
        fetch('/suggest_company?q=' + encodeURIComponent(val))
          .then(r => r.json())
          .then(items => {
            box.innerHTML = '';
            if (items && items.length > 0) {
              box.style.display = 'block';
              items.forEach(c => {
                const div = document.createElement('div');
                div.className = 'suggest-item';
                div.innerHTML = '<strong>' + c.name + '</strong> (ИНН: ' + c.inn + ')' +
                  (c.address ? '<br><small style="color:#64748b;">' + c.address + '</small>' : '');
                div.onclick = () => {
                  document.getElementById('search_input').value = c.name + ' (ИНН ' + c.inn + ')';
                  document.getElementById('inn').value = c.inn;
                  document.getElementById('company_name').value = c.name;
                  if (c.sites) document.getElementById('sites_input').value = c.sites;
                  if (c.email) document.getElementById('email_input').value = c.email;
                  box.style.display = 'none';
                  loadContracts(c.inn);
                };
                box.appendChild(div);
              });
            } else {
              box.style.display = 'none';
            }
          });
      }, 250);
    }

    function loadContracts(inn) {
      fetch('/get_contracts?inn=' + encodeURIComponent(inn))
        .then(r => r.json())
        .then(data => {
          const sel = document.getElementById('contract_select');
          sel.innerHTML = '<option value="">-- Выберите договор из Saby --</option>';
          if (data.contracts && data.contracts.length > 0) {
            data.contracts.forEach(cnt => {
              const opt = document.createElement('option');
              opt.value = cnt.id + '|||' + cnt.number + '|||' + cnt.title;
              opt.textContent = cnt.number + ' — ' + cnt.title + ' (' + (cnt.plan_hours || 15) + ' ч/мес)';
              sel.appendChild(opt);
            });
            sel.selectedIndex = 1;
            onContractChange();
          } else {
            sel.innerHTML = '<option value="cnt-auto|||№ б/н|||Договор комплексного сопровождения">№ б/н — Новый договор сопровождения Saby</option>';
            onContractChange();
          }
        });
    }

    function onContractChange() {
      const val = document.getElementById('contract_select').value;
      const parts = val.split('|||');
      document.getElementById('contract_id').value = parts[0] || '';
      document.getElementById('contract_number').value = parts[1] || '';
    }
  </script>
</body>
</html>`;
}
