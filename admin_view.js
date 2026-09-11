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

export function renderAdminClientPage({ client, activeTab = 'works', flashMessage = null, reqQuery = {} }) {
  const cId = client.id;
  const logs = db.getWorkLogs(cId);
  const summary = db.getPortalSummary(cId);
  const sabyDocs = db.getSabyDocs(cId);
  const syncLogs = db.getSabySyncLogs(cId);
  const backups = db.getBackups(cId);
  const snapshot = db.getLastSnapshot(cId);

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

    <!-- KPI Summary Grid -->
    <div class="kpi-grid">
      <!-- 1. Hours Progress -->
      <div class="glass-card kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Лимит часов в месяц</span>
          <div class="kpi-icon" style="background: rgba(124, 58, 237, 0.12); color: #6d28d9;">⏱️</div>
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

      <!-- 2. Work Logs Count -->
      <div class="glass-card kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Всего работ в CRM</span>
          <div class="kpi-icon" style="background: rgba(16, 185, 129, 0.12); color: #10b981;">📋</div>
        </div>
        <div>
          <div class="kpi-val">${logs.length} <span style="font-size:16px; font-weight:500; color:#64748b;">задач</span></div>
          <div class="kpi-sub">
            <span style="color:#059669; font-weight:600;">✓ Синхронизировано: ${syncedCount}</span>
            ${unsyncedCount > 0 ? `<span style="color:#ea580c; font-weight:600; margin-left:auto;">+${unsyncedCount} новых</span>` : ''}
          </div>
        </div>
      </div>

      <!-- 3. Saby Integration Status -->
      <div class="glass-card kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Шлюз Saby / СБИС ЭДО</span>
          <div class="kpi-icon" style="background: rgba(2, 132, 199, 0.12); color: #0284c7;">⚡</div>
        </div>
        <div>
          <div class="kpi-val" style="color:#0284c7; font-size:24px;">Связь активна</div>
          <div class="kpi-sub">
            <span>Договор: <strong>${client.saby_contract_number || 'АС-2024/05'}</strong></span>
          </div>
        </div>
      </div>

      <!-- 4. Beget Hosting Status -->
      <div class="glass-card kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Beget Cloud & Резерв</span>
          <div class="kpi-icon" style="background: rgba(245, 158, 11, 0.12); color: #d97706;">☁️</div>
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
        <span>Журнал работ и нарядов (${logs.length})</span>
      </a>
      <a href="?tab=settings" class="tab-btn ${activeTab === 'settings' ? 'active' : ''}">
        <span>⚙️</span>
        <span>Настройки и договор Saby</span>
      </a>
      <a href="?tab=saby_sync" class="tab-btn ${activeTab === 'saby_sync' ? 'active' : ''}">
        <span>🔄</span>
        <span>Двусторонняя синхронизация (${syncLogs.length})</span>
      </a>
      <a href="?tab=edo" class="tab-btn ${activeTab === 'edo' ? 'active' : ''}">
        <span>📑</span>
        <span>Документы СБИС ЭДО (${sabyDocs.length})</span>
      </a>
      <a href="?tab=report" class="tab-btn ${activeTab === 'report' ? 'active' : ''}">
        <span>📊</span>
        <span>Генерация отчёта</span>
      </a>
    </div>

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
            <h3 style="font-size:16px; font-weight:700; color:#5b21b6; margin-bottom:14px; display:flex; align-items:center; gap:8px;">
              <span>☁️</span> Инфраструктура хостинга Beget и сайты
            </h3>

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
          <button type="button" onclick="triggerSabySync(${client.id})" class="btn btn-primary">
            <span>🔄</span>
            <span>Запустить синхронизацию</span>
          </button>
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
  </script>
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
