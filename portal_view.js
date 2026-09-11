// Apple Liquid Glass Client Portal Generator
import { db } from './crm_store.js';

export function renderPortalPage({ client, contact = null, token = '', activeTab = 'home', reqQuery = {}, isAdminPreview = false }) {
  const cId = client.id;
  const summary = db.getPortalSummary(cId);
  const events = db.getServiceEvents(cId, 'all');
  const sabyDocs = db.getSabyDocs(cId);
  const backups = db.getBackups(cId);
  const snapshot = db.getLastSnapshot(cId);

  // Clients list for switcher
  const allClients = db.getClients();

  const clientSites = db.getClientSites(cId);
  const domainsList = clientSites.length > 0 ? clientSites.map(s => ({
    fqdn: s.domain,
    url: s.url,
    bitrix_admin_url: s.bitrix_admin_url,
    ssl_status: s.ssl_status,
    date_expire: '12.08.2026',
    cms: s.cms,
    cms_version: s.cms_version,
    php_version: s.php_version,
    status: s.status,
    response_time_ms: s.response_time_ms,
    last_backup: s.last_backup
  })) : [
    {
      fqdn: 'uniklinika.ru',
      url: 'https://uniklinika.ru',
      bitrix_admin_url: 'https://uniklinika.ru/bitrix/admin/',
      ssl_status: 'active',
      date_expire: '12.08.2026',
      cms: '1С-Битрикс',
      cms_version: '24.100.0',
      php_version: '8.2',
      status: 'online',
      response_time_ms: 145,
      last_backup: { date: 'Сегодня 03:15', size_mb: 3840, status: 'Успешно' }
    }
  ];

  const contractNum = client.saby_contract_number || '№ Д-2024/017';
  const planHours = client.plan_hours || 15;
  const hoursUsed = summary.hours.used;
  const hoursPercent = summary.hours.percent;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Личный кабинет — ${client.company_name} | Klimov CRM</title>
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 10% 20%, rgba(235, 238, 255, 0.9) 0%, rgba(244, 240, 255, 0.8) 50%, rgba(247, 249, 254, 0.95) 100%);
      --glass-bg: rgba(255, 255, 255, 0.68);
      --glass-bg-hover: rgba(255, 255, 255, 0.85);
      --glass-border: rgba(255, 255, 255, 0.7);
      --glass-border-subtle: rgba(230, 233, 245, 0.7);
      --glass-shadow: 0 12px 36px 0 rgba(31, 38, 135, 0.06), 0 2px 6px 0 rgba(0, 0, 0, 0.02);
      --glass-shadow-hover: 0 16px 42px 0 rgba(103, 58, 183, 0.12), 0 4px 10px 0 rgba(0, 0, 0, 0.03);
      --primary-purple: #6d28d9;
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
      position: relative;
      overflow-x: hidden;
    }

    /* Ambient decorative liquid glass glows */
    .ambient-glow-1 {
      position: fixed;
      width: 500px; height: 500px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(167, 139, 250, 0.22) 0%, rgba(255, 255, 255, 0) 70%);
      top: -150px; right: -100px;
      z-index: 0; pointer-events: none; filter: blur(50px);
    }
    .ambient-glow-2 {
      position: fixed;
      width: 450px; height: 450px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, rgba(255, 255, 255, 0) 70%);
      bottom: -100px; left: -100px;
      z-index: 0; pointer-events: none; filter: blur(60px);
    }

    .app-layout {
      display: flex;
      min-height: 100vh;
      position: relative;
      z-index: 1;
    }

    /* --- SIDEBAR --- */
    .sidebar {
      width: 260px;
      background: rgba(255, 255, 255, 0.55);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-right: 1px solid var(--glass-border);
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: sticky;
      top: 0;
      height: 100vh;
      flex-shrink: 0;
    }

    .brand-block {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px 24px;
      border-bottom: 1px solid rgba(226, 232, 240, 0.6);
      margin-bottom: 20px;
    }

    .brand-icon {
      width: 38px; height: 38px;
      border-radius: 10px;
      background: var(--primary-gradient);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 800; font-size: 19px;
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35);
    }

    .brand-text h2 {
      font-size: 16px; font-weight: 700; color: #1e1b4b; letter-spacing: -0.3px;
    }
    .brand-text span {
      font-size: 12px; color: var(--text-secondary);
    }

    .nav-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: var(--radius-md);
      color: #475569;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
    }

    .nav-link svg {
      width: 18px; height: 18px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      transition: transform 0.15s;
    }

    .nav-link:hover {
      background: rgba(255, 255, 255, 0.7);
      color: var(--primary-purple);
      transform: translateX(2px);
    }

    .nav-link.active {
      background: rgba(124, 58, 237, 0.12);
      color: var(--primary-purple);
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(124, 58, 237, 0.08);
    }

    .nav-link.active svg {
      stroke: var(--primary-purple);
    }

    .sidebar-footer-card {
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.8);
      border-radius: var(--radius-md);
      padding: 14px;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    }

    .support-online-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #047857;
      background: #d1fae5;
      padding: 3px 8px;
      border-radius: 20px;
      margin-top: 6px;
    }

    /* --- MAIN CONTENT AREA --- */
    .main-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      max-height: 100vh;
    }

    /* Top Glass Navbar */
    .topbar {
      height: 68px;
      background: rgba(255, 255, 255, 0.62);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--glass-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .client-select-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid var(--glass-border-subtle);
      border-radius: 24px;
      padding: 6px 14px 6px 12px;
      font-size: 13.5px;
      font-weight: 600;
      color: #334155;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
      cursor: pointer;
    }

    .client-select-pill select {
      border: none;
      background: transparent;
      font-size: 13.5px;
      font-weight: 600;
      color: #1e293b;
      cursor: pointer;
      outline: none;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .month-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid var(--glass-border-subtle);
      border-radius: 20px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }

    .btn-bitrix-admin {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      color: #ffffff !important;
      font-weight: 700;
      font-size: 12.5px;
      padding: 7px 14px;
      border-radius: 8px;
      text-decoration: none;
      box-shadow: 0 2px 8px rgba(220, 38, 38, 0.25);
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .btn-bitrix-admin:hover {
      background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);
    }
    .btn-site-visit {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #f8fafc;
      color: #334155 !important;
      font-weight: 600;
      font-size: 12.5px;
      padding: 7px 12px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      text-decoration: none;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .btn-site-visit:hover {
      background: #e2e8f0;
      color: #0f172a !important;
    }

    .icon-btn {
      width: 38px; height: 38px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.75);
      border: 1px solid var(--glass-border-subtle);
      display: flex; align-items: center; justify-content: center;
      color: #475569;
      cursor: pointer;
      position: relative;
      transition: background 0.15s;
    }
    .icon-btn:hover { background: #fff; color: var(--primary-purple); }

    .notif-badge {
      position: absolute;
      top: 7px; right: 7px;
      width: 8px; height: 8px;
      background: #ef4444;
      border-radius: 50%;
      box-shadow: 0 0 0 2px #fff;
    }

    .user-pill {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 4px 10px 4px 4px;
      background: rgba(255, 255, 255, 0.75);
      border: 1px solid var(--glass-border-subtle);
      border-radius: 24px;
      cursor: pointer;
    }
    .user-avatar {
      width: 30px; height: 30px;
      border-radius: 50%;
      background: var(--primary-gradient);
      color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
    }
    .user-name {
      font-size: 13px; font-weight: 600; color: #1e293b;
    }

    /* Content Area */
    .content-area {
      padding: 32px;
      max-width: 1240px;
      width: 100%;
      margin: 0 auto;
    }

    /* --- GLASS CARDS COMMON --- */
    .glass-card {
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      box-shadow: var(--glass-shadow);
      padding: 24px;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
      overflow: hidden;
    }

    .glass-card:hover {
      box-shadow: var(--glass-shadow-hover);
      border-color: rgba(255, 255, 255, 0.95);
    }

    /* Primary Liquid Glass Button */
    .btn-liquid {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: var(--primary-gradient);
      color: #ffffff;
      padding: 14px 28px;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      border: 1px solid rgba(255, 255, 255, 0.3);
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(124, 58, 237, 0.28), inset 0 1px 1px rgba(255, 255, 255, 0.4);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .btn-liquid:hover {
      background: var(--primary-gradient-hover);
      transform: translateY(-1px);
      box-shadow: 0 12px 26px rgba(124, 58, 237, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.5);
    }

    .btn-liquid-secondary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.85);
      color: #334155;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid var(--glass-border-subtle);
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
      transition: all 0.15s;
    }
    .btn-liquid-secondary:hover {
      background: #ffffff;
      color: var(--primary-purple);
      border-color: rgba(124, 58, 237, 0.3);
    }

    /* === SCREEN 1: CLIENT PORTAL HOME (Mockup 3) === */
    .welcome-hero {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(243, 239, 255, 0.7) 100%);
      border: 1px solid rgba(255, 255, 255, 0.9);
      border-radius: 24px;
      padding: 32px 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
      box-shadow: 0 16px 40px rgba(103, 58, 183, 0.06);
      position: relative;
    }

    .welcome-hero h1 {
      font-size: 28px;
      font-weight: 800;
      color: #1e1b4b;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }

    .status-active-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 20px;
      color: #065f46;
      font-size: 13px;
      font-weight: 600;
      margin-top: 8px;
    }
    .status-dot-pulse {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
    }

    .hero-shield-art {
      width: 110px; height: 110px;
      border-radius: 24px;
      background: linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(99, 102, 241, 0.2) 100%);
      border: 1px solid rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 14px 28px rgba(124, 58, 237, 0.12);
    }

    /* 4 Primary Cards Grid */
    .metrics-4-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 28px;
    }
    @media (max-width: 1024px) {
      .metrics-4-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .metrics-4-grid { grid-template-columns: 1fr; }
    }

    .metric-card {
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 22px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 165px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .metric-card:hover {
      transform: translateY(-2px);
      background: var(--glass-bg-hover);
      box-shadow: var(--glass-shadow-hover);
    }

    .metric-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .metric-card-title {
      font-size: 15px;
      font-weight: 700;
      color: #1e1b4b;
    }
    .metric-card-subtitle {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .metric-icon-wrap {
      width: 40px; height: 40px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
    }
    .icon-purple { background: rgba(124, 58, 237, 0.12); color: #7c3aed; }
    .icon-green { background: rgba(16, 185, 129, 0.12); color: #10b981; }
    .icon-cyan { background: rgba(6, 182, 212, 0.12); color: #0891b2; }
    .icon-indigo { background: rgba(99, 102, 241, 0.12); color: #4f46e5; }

    .metric-card-value {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin-bottom: 4px;
    }

    .metric-card-link {
      font-size: 13px;
      font-weight: 600;
      color: var(--primary-purple);
      display: flex; align-items: center; gap: 4px;
      margin-top: 8px;
    }

    /* Maintenance Alert Banner */
    .maintenance-banner {
      background: rgba(254, 243, 199, 0.6);
      backdrop-filter: blur(12px);
      border: 1px solid #fde68a;
      border-radius: var(--radius-md);
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
      font-size: 14px;
      color: #92400e;
    }

    .maintenance-banner a {
      color: #b45309;
      font-weight: 700;
      text-decoration: none;
    }

    /* 4 Feature Value Pillars */
    .value-pillars {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid rgba(226, 232, 240, 0.6);
    }
    @media (max-width: 900px) { .value-pillars { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 500px) { .value-pillars { grid-template-columns: 1fr; } }

    .pillar-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 13px;
      color: #475569;
      line-height: 1.45;
    }
    .pillar-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    /* === SCREEN 2: SERVICE EVENTS (Mockup 1) === */
    .events-screen-layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 28px;
    }
    @media (max-width: 1024px) {
      .events-screen-layout { grid-template-columns: 1fr; }
    }

    .filter-pills-row {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .filter-pill {
      padding: 8px 18px;
      border-radius: 20px;
      font-size: 13.5px;
      font-weight: 600;
      color: #64748b;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid var(--glass-border-subtle);
      cursor: pointer;
      transition: all 0.15s;
    }
    .filter-pill:hover { background: #fff; color: #1e293b; }
    .filter-pill.active {
      background: #1e1b4b;
      color: #ffffff;
      border-color: #1e1b4b;
      box-shadow: 0 4px 12px rgba(30, 27, 75, 0.18);
    }

    .timeline-group-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      margin: 22px 0 10px 4px;
    }

    .event-card {
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      padding: 16px 20px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.15s;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    }
    .event-card:hover {
      background: #ffffff;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.04);
      transform: translateX(2px);
    }

    .event-left {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .event-time {
      font-size: 14px;
      font-weight: 700;
      color: #64748b;
      width: 46px;
      flex-shrink: 0;
      padding-top: 2px;
    }

    .event-body h4 {
      font-size: 15px;
      font-weight: 700;
      color: #1e1b4b;
      margin-bottom: 3px;
    }

    .event-meta {
      font-size: 13px;
      color: #64748b;
    }
    .event-meta strong {
      color: #334155;
    }

    .badge-status-done {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12.5px;
      font-weight: 600;
      background: #dcfce7;
      color: #15803d;
    }

    .badge-status-progress {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12.5px;
      font-weight: 600;
      background: #e0f2fe;
      color: #0369a1;
    }

    /* Right Sidebar in Events */
    .sla-card {
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 22px;
      margin-bottom: 20px;
      box-shadow: var(--glass-shadow);
    }

    .sla-circle-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 18px 0;
    }

    .sla-stat-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(226, 232, 240, 0.6);
      font-size: 13.5px;
      color: #475569;
    }
    .sla-stat-row:last-child { border-bottom: none; }
    .sla-stat-row strong { color: #1e293b; }

    /* === SCREEN 3: DETAILED REPORT (Mockup 2) === */
    .report-top-kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
      margin-bottom: 24px;
    }
    @media (max-width: 900px) { .report-top-kpis { grid-template-columns: repeat(2, 1fr); } }

    .kpi-box {
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      padding: 18px 20px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
    }
    .kpi-title { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
    .kpi-value { font-size: 26px; font-weight: 800; color: #1e1b4b; margin: 4px 0 2px; }
    .kpi-delta { font-size: 12px; font-weight: 600; }
    .delta-green { color: #10b981; }
    .delta-muted { color: #64748b; }

    .report-middle-grid {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    @media (max-width: 1080px) {
      .report-middle-grid { grid-template-columns: 1fr; }
    }

    .report-bottom-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 20px;
      margin-bottom: 28px;
    }
    @media (max-width: 900px) {
      .report-bottom-grid { grid-template-columns: 1fr; }
    }

    /* Donut chart legend */
    .legend-list {
      list-style: none;
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12.5px;
      color: #475569;
    }
    .legend-dot-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
    }

    /* Daily Backups Bar Chart */
    .backup-bars-wrap {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      height: 90px;
      padding-top: 10px;
      margin: 16px 0;
    }
    .b-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      flex: 1;
    }
    .b-bar {
      width: 22px;
      height: 60px;
      background: linear-gradient(180deg, #10b981 0%, #34d399 100%);
      border-radius: 6px;
      transition: transform 0.15s;
    }
    .b-bar:hover { transform: scaleY(1.05); }
    .b-label { font-size: 11px; color: #64748b; }

    /* Modal Backdrop and Box */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 20px;
    }
    .modal-overlay.open { display: flex; }

    .modal-card {
      background: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.8);
      border-radius: 20px;
      width: min(520px, 100%);
      padding: 30px;
      box-shadow: 0 25px 60px rgba(15, 23, 42, 0.2);
      animation: modalEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes modalEnter {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    .form-group {
      margin-bottom: 16px;
    }
    .form-group label {
      display: block;
      font-size: 13.5px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 6px;
    }
    .form-group input, .form-group select, .form-group textarea {
      width: 100%;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
    }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
      border-color: var(--primary-purple);
    }

    /* Print styles */
    @media print {
      body { background: #fff !important; color: #000 !important; }
      .sidebar, .topbar, .btn-liquid, .modal-overlay, .no-print { display: none !important; }
      .main-wrapper { max-height: none !important; overflow: visible !important; }
      .glass-card { box-shadow: none !important; border: 1px solid #ddd !important; break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="ambient-glow-1"></div>
  <div class="ambient-glow-2"></div>

  <div class="app-layout">
    <!-- LEFT GLASS SIDEBAR -->
    <aside class="sidebar">
      <div>
        <div class="brand-block">
          <div class="brand-icon">K</div>
          <div class="brand-text">
            <h2>Klimov CRM</h2>
            <span>Клиентский портал</span>
          </div>
        </div>

        <ul class="nav-list">
          <li>
            <a class="nav-link ${activeTab === 'home' ? 'active' : ''}" onclick="switchTab('home')">
              <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              Главная
            </a>
          </li>
          <li>
            <a class="nav-link ${activeTab === 'events' ? 'active' : ''}" onclick="switchTab('events')">
              <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              События сервиса
            </a>
          </li>
          <li>
            <a class="nav-link ${activeTab === 'report' ? 'active' : ''}" onclick="switchTab('report')">
              <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
              Отчёт за период
            </a>
          </li>
          <li>
            <a class="nav-link ${activeTab === 'saby' ? 'active' : ''}" onclick="switchTab('saby')">
              <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Договоры и СБИС
            </a>
          </li>
          <li>
            <a class="nav-link ${activeTab === 'backups' ? 'active' : ''}" onclick="switchTab('backups')">
              <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              Резервные копии
            </a>
          </li>
          <li>
            <a class="nav-link ${activeTab === 'domains' ? 'active' : ''}" onclick="switchTab('domains')">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              Сайты и 1С-Битрикс
            </a>
          </li>
          <li>
            <a class="nav-link" onclick="openTicketModal()">
              <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              Поддержка
            </a>
          </li>
        </ul>
      </div>

      <div>
        <div class="sidebar-footer-card">
          <div style="font-weight:700; color:#1e1b4b; font-size:13px;">${contact ? 'Авторизованный доступ' : 'Техподдержка 24/7'}</div>
          <div style="color:var(--text-secondary); font-size:12px; margin-top:2px;">
            ${contact ? contact.name : 'Инженер: Климов Евгений'}
          </div>
          <span class="support-online-badge" style="${contact ? 'background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0;' : ''}">
            <span style="width:6px; height:6px; background:#10b981; border-radius:50%;"></span>
            ${contact ? '2FA Верифицирован' : 'Онлайн'}
          </span>
        </div>
        <div style="margin-top:10px; text-align:center;">
          ${contact ? `
            <a href="/portal/logout" style="font-size:12px; color:#ef4444; font-weight:600; text-decoration:none;">🚪 Завершить сеанс</a>
          ` : `
            <a href="/" style="font-size:11.5px; color:#64748b; text-decoration:none;">Перейти в панель CRM &rarr;</a>
          `}
        </div>
      </div>
    </aside>

    <!-- MAIN SCROLLABLE WRAPPER -->
    <div class="main-wrapper">
      ${isAdminPreview ? `
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: #fff; padding: 10px 24px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">👀</span>
            <span><strong>Режим предпросмотра администратора CRM (Евгений Климов)</strong>: просмотр личного кабинета <em>${client.company_name}</em></span>
          </div>
          <a href="/client/${client.id}?tab=contacts" style="color: #c7d2fe; text-decoration: none; font-weight: 700; font-size: 12.5px; background: rgba(255,255,255,0.12); padding: 4px 10px; border-radius: 6px;">
            Управление контактами и ссылками &rarr;
          </a>
        </div>
      ` : ''}

      <!-- TOP GLASS NAVBAR -->
      <header class="topbar">
        <div class="topbar-left">
          ${isAdminPreview ? `
            <div class="client-select-pill">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M9 21V9h6v12M9 5h6"></path></svg>
              <select onchange="window.location.href='/portal/' + this.value">
                ${allClients.map(c => `
                  <option value="${c.id}" ${c.id === client.id ? 'selected' : ''}>${c.company_name}</option>
                `).join('')}
              </select>
            </div>
          ` : `
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🏢</span>
              <span style="font-weight: 700; color: #1e1b4b; font-size: 14.5px;">${client.company_name}</span>
              <span class="badge" style="background: #ede9fe; color: #6d28d9; font-size: 11.5px; padding: 2px 8px; border-radius: 6px; font-weight: 600;">Договор: ${contractNum}</span>
            </div>
          `}
        </div>

        <div class="topbar-right">
          <div class="month-pill">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Май 2026
          </div>

          <button class="icon-btn" title="Уведомления" onclick="switchTab('events')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            <span class="notif-badge"></span>
          </button>

          <div class="user-pill" style="display: flex; align-items: center; gap: 10px; padding: 6px 14px; background: rgba(255,255,255,0.85); border-radius: 30px; border: 1px solid rgba(226,232,240,0.8);">
            <div class="user-avatar" style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #fff; font-weight: 700;">
              ${contact ? contact.name.split(' ').map(w => w[0]).slice(0, 2).join('') : (client.company_name || 'К')[0]}
            </div>
            <div style="display: flex; flex-direction: column; text-align: left;">
              <span class="user-name" style="font-weight: 700; font-size: 13px; line-height: 1.2; color: #1e1b4b;">
                ${contact ? contact.name : client.company_name}
              </span>
              <span style="font-size: 11px; color: #64748b; line-height: 1.1;">
                ${contact ? `${contact.position || 'Представитель'} • ${contact.role === 'full' ? 'Полный доступ' : contact.role === 'technical' ? 'Технический' : 'Финансовый'}` : 'Клиентский доступ'}
              </span>
            </div>
            ${contact ? `
              <a href="/portal/logout" title="Выйти из личного кабинета" style="margin-left: 6px; color: #ef4444; text-decoration: none; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              </a>
            ` : ''}
          </div>
        </div>
      </header>

      <!-- VIEW CONTAINER -->
      <main class="content-area">

        <!-- ============================================== -->
        <!-- TAB 1: ГЛАВНАЯ (Mockup 3: Сервис под контролем) -->
        <!-- ============================================== -->
        <div id="tab-home" class="tab-pane" style="display: ${activeTab === 'home' ? 'block' : 'none'};">
          <!-- Hero Section -->
          <div class="welcome-hero">
            <div>
              <div style="font-size:14px; color:var(--text-secondary); font-weight:600; margin-bottom:4px;">
                Добрый день, представитель ${client.company_name}
              </div>
              <h1>Сервис под контролем</h1>
              <div class="status-active-pill">
                <span class="status-dot-pulse"></span>
                Все системы работают стабильно
              </div>
            </div>

            <div class="hero-shield-art">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="url(#shieldGrad)" stroke="#7c3aed" stroke-width="1.5" />
                <path d="M9 12l2 2 4-4" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <defs>
                  <linearGradient id="shieldGrad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#8b5cf6" stop-opacity="0.9"/>
                    <stop offset="1" stop-color="#6366f1" stop-opacity="0.95"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          <!-- 4 Main Cards Grid -->
          <div class="metrics-4-grid">
            <!-- 1. Reports -->
            <div class="metric-card" onclick="switchTab('report')">
              <div>
                <div class="metric-card-header">
                  <div>
                    <div class="metric-card-title">Отчёты</div>
                    <div class="metric-card-subtitle">Доступные отчёты по услугам</div>
                  </div>
                  <div class="metric-icon-wrap icon-purple">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                  </div>
                </div>
                <div class="metric-card-value">${summary.reports_count}</div>
              </div>
              <div class="metric-card-link">
                готовы к просмотру &rarr;
              </div>
            </div>

            <!-- 2. Contract Works -->
            <div class="metric-card" onclick="switchTab('report')">
              <div>
                <div class="metric-card-header">
                  <div>
                    <div class="metric-card-title">Работы по договору</div>
                    <div class="metric-card-subtitle">Выполнено в этом месяце</div>
                  </div>
                  <div class="metric-icon-wrap icon-green">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                </div>
                <div class="metric-card-value">${hoursUsed} / ${planHours} ч</div>
                <div style="background:#e2e8f0; border-radius:4px; height:6px; overflow:hidden; margin:8px 0 4px;">
                  <div style="width:${Math.min(100, hoursPercent)}%; height:100%; background:#10b981;"></div>
                </div>
              </div>
              <div class="metric-card-link">
                ${hoursPercent}% от плана &rarr;
              </div>
            </div>

            <!-- 3. Backups -->
            <div class="metric-card" onclick="switchTab('backups')">
              <div>
                <div class="metric-card-header">
                  <div>
                    <div class="metric-card-title">Резервные копии</div>
                    <div class="metric-card-subtitle">Последняя копия</div>
                  </div>
                  <div class="metric-icon-wrap icon-cyan">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  </div>
                </div>
                <div class="metric-card-value" style="font-size:19px;">
                  ${summary.latest_backup ? summary.latest_backup.date.slice(0, 16) : '28.05.2026 03:15'}
                </div>
              </div>
              <div class="metric-card-link">
                Все системы защищены &rarr;
              </div>
            </div>

            <!-- 4. Domains and SSL -->
            <div class="metric-card" onclick="switchTab('domains')">
              <div>
                <div class="metric-card-header">
                  <div>
                    <div class="metric-card-title">Домены и SSL</div>
                    <div class="metric-card-subtitle">Активные домены</div>
                  </div>
                  <div class="metric-icon-wrap icon-indigo">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                  </div>
                </div>
                <div class="metric-card-value">${domainsList.length}</div>
              </div>
              <div class="metric-card-link">
                SSL-сертификаты действуют &rarr;
              </div>
            </div>
          </div>

          <!-- Primary CTA Button matching Mockup 3 -->
          <div style="text-align:center; margin: 32px 0;">
            <button class="btn-liquid" onclick="switchTab('report')" style="font-size:16px; padding: 16px 36px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              Сформировать отчёт &rarr;
            </button>
          </div>

          <!-- Maintenance Banner -->
          <div class="maintenance-banner">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:18px;">ℹ️</span>
              <div>
                <strong>Плановые работы:</strong> 02.06.2026 с 02:00 до 04:00 МСК на сервере CRM-DB-01 (оптимизация индексов)
              </div>
            </div>
            <a href="javascript:void(0)" onclick="switchTab('events')">Подробнее &rarr;</a>
          </div>

          <!-- 4 Feature Value Pillars at bottom -->
          <div class="value-pillars">
            <div class="pillar-item">
              <span class="pillar-icon">🛡️</span>
              <div><strong>Полный контроль</strong><br>над всеми услугами, сайтами и серверными процессами</div>
            </div>
            <div class="pillar-item">
              <span class="pillar-icon">📊</span>
              <div><strong>Прозрачная отчётность</strong><br>актуальные данные из Saby и Beget в реальном времени</div>
            </div>
            <div class="pillar-item">
              <span class="pillar-icon">🔔</span>
              <div><strong>Своевременные уведомления</strong><br>и напоминания об оплате, SSL и бэкапах</div>
            </div>
            <div class="pillar-item">
              <span class="pillar-icon">🔒</span>
              <div><strong>Безопасность и защита</strong><br>ваших данных и резервных копий 1С-Битрикс</div>
            </div>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- TAB 2: СОБЫТИЯ СЕРВИСА (Mockup 1)             -->
        <!-- ============================================== -->
        <div id="tab-events" class="tab-pane" style="display: ${activeTab === 'events' ? 'block' : 'none'};">
          <!-- Screen Header with Button "+ Открыть обращение" -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
            <div>
              <h1 style="font-size: 26px; font-weight:800; color:#1e1b4b; margin-bottom:4px;">События сервиса</h1>
              <p style="font-size: 14px; color:var(--text-secondary);">История всех ключевых событий по вашим услугам и договорам</p>
            </div>
            <button class="btn-liquid" onclick="openTicketModal()">
              + Открыть обращение
            </button>
          </div>

          <div class="events-screen-layout">
            <!-- Left: Timeline with Filter Pills -->
            <div>
              <div class="filter-pills-row">
                <button class="filter-pill active" onclick="filterEvents('all', this)">Все</button>
                <button class="filter-pill" onclick="filterEvents('work', this)">Работы</button>
                <button class="filter-pill" onclick="filterEvents('backup', this)">Резервные копии</button>
                <button class="filter-pill" onclick="filterEvents('incident', this)">Инциденты</button>
              </div>

              <!-- Events List -->
              <div id="events-feed">
                <!-- Group Сегодня -->
                <div class="timeline-group-title">Сегодня</div>
                ${events.filter(e => e.group === 'today').map(e => `
                  <div class="event-card" data-cat="${e.category}">
                    <div class="event-left">
                      <div class="event-time">${e.time || '09:41'}</div>
                      <div class="event-body">
                        <h4>${e.title}</h4>
                        <div class="event-meta">
                          Услуга: <strong>${e.service}</strong> &bull; ${e.detail_label}: <strong>${e.detail_value}</strong>
                        </div>
                      </div>
                    </div>
                    <div>
                      ${e.status_type === 'done'
                        ? '<span class="badge-status-done">&check; Готово</span>'
                        : '<span class="badge-status-progress">&bull; В работе</span>'}
                    </div>
                  </div>
                `).join('')}

                <!-- Group Вчера -->
                <div class="timeline-group-title">Вчера</div>
                ${events.filter(e => e.group === 'yesterday').map(e => `
                  <div class="event-card" data-cat="${e.category}">
                    <div class="event-left">
                      <div class="event-time">${e.time || '17:32'}</div>
                      <div class="event-body">
                        <h4>${e.title}</h4>
                        <div class="event-meta">
                          Услуга: <strong>${e.service}</strong> &bull; ${e.detail_label}: <strong>${e.detail_value}</strong>
                        </div>
                      </div>
                    </div>
                    <div>
                      ${e.status_type === 'done'
                        ? '<span class="badge-status-done">&check; Готово</span>'
                        : '<span class="badge-status-progress">&bull; В работе</span>'}
                    </div>
                  </div>
                `).join('')}

                <!-- Group Ранее (20 мая) -->
                <div class="timeline-group-title">20 мая</div>
                ${events.filter(e => e.group === 'earlier').map(e => `
                  <div class="event-card" data-cat="${e.category}">
                    <div class="event-left">
                      <div class="event-time">${e.time || '15:22'}</div>
                      <div class="event-body">
                        <h4>${e.title}</h4>
                        <div class="event-meta">
                          Услуга: <strong>${e.service}</strong> &bull; ${e.detail_label}: <strong>${e.detail_value}</strong>
                        </div>
                      </div>
                    </div>
                    <div>
                      ${e.status_type === 'done'
                        ? '<span class="badge-status-done">&check; Готово</span>'
                        : '<span class="badge-status-progress">&bull; В работе</span>'}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Right Sidebar: SLA + Active Works + Upcoming -->
            <div>
              <!-- SLA Card -->
              <div class="sla-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <h3 style="font-size:16px; font-weight:700; color:#1e1b4b;">SLA по услугам</h3>
                  <span style="font-size:12px; color:var(--text-secondary); font-weight:600;">Июнь 2024 &#9662;</span>
                </div>

                <!-- Circular Gauge -->
                <div class="sla-circle-container">
                  <svg width="130" height="130" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="#e2e8f0" stroke-width="8" fill="transparent"/>
                    <circle cx="50" cy="50" r="42" stroke="#10b981" stroke-width="8" fill="transparent"
                      stroke-dasharray="263.89" stroke-dashoffset="1.05" stroke-linecap="round"
                      transform="rotate(-90 50 50)"/>
                    <text x="50" y="47" text-anchor="middle" font-size="16" font-weight="800" fill="#1e1b4b">99,6%</text>
                    <text x="50" y="63" text-anchor="middle" font-size="9" font-weight="600" fill="#64748b">Доступность</text>
                  </svg>
                  <span style="font-size:12px; color:#10b981; font-weight:600; margin-top:4px;">Цель: 99,5% (Выполняется)</span>
                </div>

                <div class="sla-stat-row">
                  <span>ℹ️ Инциденты:</span>
                  <strong>2</strong>
                </div>
                <div class="sla-stat-row">
                  <span>⏱ Время реакции (ср.):</span>
                  <strong>18 мин</strong>
                </div>
                <div class="sla-stat-row">
                  <span>⏱ Время решения (ср.):</span>
                  <strong>2 ч 47 мин</strong>
                </div>

                <a href="javascript:void(0)" onclick="switchTab('report')" style="display:block; font-size:13px; color:var(--primary-purple); font-weight:600; text-decoration:none; margin-top:12px;">
                  Подробнее о SLA &rarr;
                </a>
              </div>

              <!-- Active Works Card -->
              <div class="sla-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                  <h3 style="font-size:16px; font-weight:700; color:#1e1b4b;">Активные работы (2)</h3>
                </div>

                <div style="margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid #f1f5f9;">
                  <div style="font-size:11px; color:#64748b;">Техническая поддержка</div>
                  <div style="font-size:13.5px; font-weight:600; color:#1e1b4b; margin:2px 0;">Настройка почтового сервера</div>
                  <span class="badge-status-progress" style="font-size:11px; padding:2px 8px;">&bull; В работе</span>
                </div>

                <div style="margin-bottom:8px;">
                  <div style="font-size:11px; color:#64748b;">Инфраструктура</div>
                  <div style="font-size:13.5px; font-weight:600; color:#1e1b4b; margin:2px 0;">Обновление ПО и 1С-Битрикс</div>
                  <span class="badge-status-progress" style="font-size:11px; padding:2px 8px;">&bull; В работе</span>
                </div>

                <a href="javascript:void(0)" onclick="switchTab('report')" style="display:block; font-size:13px; color:var(--primary-purple); font-weight:600; text-decoration:none; margin-top:12px;">
                  Все активные работы &rarr;
                </a>
              </div>

              <!-- Upcoming maintenance -->
              <div class="sla-card">
                <h3 style="font-size:16px; font-weight:700; color:#1e1b4b; margin-bottom:10px;">Ближайшие события</h3>
                <p style="font-size:13px; color:#475569; line-height:1.5;">
                  📅 <strong>24 мая:</strong> Плановое обслуживание CRM-DB-01 02:00 &ndash; 04:00 МСК
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- TAB 3: ОТЧЁТ ЗА ПЕРИОД (Mockup 2)             -->
        <!-- ============================================== -->
        <div id="tab-report" class="tab-pane" style="display: ${activeTab === 'report' ? 'block' : 'none'};">
          <!-- Header with Date Picker -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
            <div>
              <h1 style="font-size: 26px; font-weight:800; color:#1e1b4b; margin-bottom:4px;">Отчёт за период</h1>
              <p style="font-size: 14px; color:var(--text-secondary);">Комплексная аналитика сопровождения серверов, доменов и обращений</p>
            </div>

            <div style="display:flex; gap:10px; align-items:center;">
              <div class="client-select-pill">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>01.05.2026 — 31.05.2026 &#9662;</span>
              </div>
              <button class="btn-liquid-secondary" onclick="window.print()">
                📥 Скачать PDF
              </button>
              <button class="btn-liquid" onclick="generateSabyAct()">
                📑 Сформировать акт в СБИС
              </button>
            </div>
          </div>

          <!-- Top 4 Metrics -->
          <div class="report-top-kpis">
            <div class="kpi-box">
              <div class="kpi-title">Всего часов</div>
              <div class="kpi-value">128,5 ч</div>
              <div class="kpi-delta delta-muted">План: 140 ч (в рамках лимита)</div>
            </div>

            <div class="kpi-box">
              <div class="kpi-title">Выполнено задач</div>
              <div class="kpi-value">46</div>
              <div class="kpi-delta delta-green">+15 к апрелю</div>
            </div>

            <div class="kpi-box">
              <div class="kpi-title">Инцидентов</div>
              <div class="kpi-value">7</div>
              <div class="kpi-delta delta-green">-3 к апрелю</div>
            </div>

            <div class="kpi-box">
              <div class="kpi-title">Доступность</div>
              <div class="kpi-value">99,96%</div>
              <div class="kpi-delta delta-green">SLA: 99,90% (цель выполнена)</div>
            </div>
          </div>

          <!-- Middle Row (3 cards: Works breakdown + Incidents & SLA + Backups 100%) -->
          <div class="report-middle-grid">
            <!-- Card 1: Completed Works with Donut Chart and Weekly Bar Chart -->
            <div class="glass-card">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
                <h3 style="font-size:16px; font-weight:700; color:#1e1b4b;">Выполненные работы</h3>
                <span style="font-size:12px; color:#10b981; font-weight:600;">+18,5 ч к апрелю</span>
              </div>
              <div style="font-size:24px; font-weight:800; color:#1e1b4b; margin-bottom:14px;">128,5 ч</div>

              <!-- SVG Donut Chart for Categories -->
              <div style="display:flex; align-items:center; justify-content:center; margin: 10px 0;">
                <svg width="140" height="140" viewBox="0 0 100 100">
                  <!-- Segments: Dev 48% (150.8), Support 30% (94.2), Admin 14% (44), Consult 8% (25.1) total 314.15 -->
                  <circle cx="50" cy="50" r="40" stroke="#7c3aed" stroke-width="14" fill="transparent"
                    stroke-dasharray="150.8 163.3" stroke-dashoffset="0" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="40" stroke="#3b82f6" stroke-width="14" fill="transparent"
                    stroke-dasharray="94.2 220" stroke-dashoffset="-150.8" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="40" stroke="#10b981" stroke-width="14" fill="transparent"
                    stroke-dasharray="44 270.1" stroke-dashoffset="-245" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="40" stroke="#f59e0b" stroke-width="14" fill="transparent"
                    stroke-dasharray="25.1 289" stroke-dashoffset="-289" transform="rotate(-90 50 50)" />
                  <text x="50" y="54" text-anchor="middle" font-size="13" font-weight="800" fill="#1e1b4b">128,5 ч</text>
                </svg>
              </div>

              <!-- Legend -->
              <ul class="legend-list">
                <li class="legend-item">
                  <span class="legend-dot-label"><span class="legend-dot" style="background:#7c3aed;"></span>Разработка</span>
                  <strong>62,0 ч (48%)</strong>
                </li>
                <li class="legend-item">
                  <span class="legend-dot-label"><span class="legend-dot" style="background:#3b82f6;"></span>Поддержка</span>
                  <strong>38,5 ч (30%)</strong>
                </li>
                <li class="legend-item">
                  <span class="legend-dot-label"><span class="legend-dot" style="background:#10b981;"></span>Администрирование</span>
                  <strong>18,0 ч (14%)</strong>
                </li>
                <li class="legend-item">
                  <span class="legend-dot-label"><span class="legend-dot" style="background:#f59e0b;"></span>Консультации</span>
                  <strong>10,0 ч (8%)</strong>
                </li>
              </ul>

              <!-- Weekly Bar Chart -->
              <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid #f1f5f9;">
                <div style="font-size:12px; font-weight:600; color:#64748b; margin-bottom:8px;">Динамика по неделям</div>
                <div style="display:flex; justify-content:space-between; align-items:flex-end; height:70px; gap:8px;">
                  <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <div style="width:100%; height:52px; background:linear-gradient(180deg,#8b5cf6,#c4b5fd); border-radius:4px;" title="32 ч"></div>
                    <span style="font-size:10px; color:#64748b;">01-07</span>
                  </div>
                  <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <div style="width:100%; height:46px; background:linear-gradient(180deg,#8b5cf6,#c4b5fd); border-radius:4px;" title="28 ч"></div>
                    <span style="font-size:10px; color:#64748b;">08-14</span>
                  </div>
                  <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <div style="width:100%; height:58px; background:linear-gradient(180deg,#7c3aed,#a78bfa); border-radius:4px;" title="35 ч"></div>
                    <span style="font-size:10px; color:#64748b;">15-21</span>
                  </div>
                  <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <div style="width:100%; height:55px; background:linear-gradient(180deg,#7c3aed,#a78bfa); border-radius:4px;" title="33,5 ч"></div>
                    <span style="font-size:10px; color:#64748b;">22-31</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Card 2: Incidents & SLA -->
            <div class="glass-card">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
                <h3 style="font-size:16px; font-weight:700; color:#1e1b4b;">Инциденты и SLA</h3>
                <span style="font-size:12px; color:#10b981; font-weight:600;">SLA: 100%</span>
              </div>
              <div style="font-size:24px; font-weight:800; color:#1e1b4b; margin-bottom:14px;">7 инцидентов</div>

              <!-- Mini severity breakdown -->
              <div style="display:flex; gap:6px; margin: 12px 0 16px;">
                <div style="flex:1; padding:8px; background:#fef2f2; border-radius:8px; text-align:center;">
                  <div style="font-size:16px; font-weight:800; color:#dc2626;">1</div>
                  <div style="font-size:10px; color:#991b1b;">Крит.</div>
                </div>
                <div style="flex:2; padding:8px; background:#fff7ed; border-radius:8px; text-align:center;">
                  <div style="font-size:16px; font-weight:800; color:#ea580c;">2</div>
                  <div style="font-size:10px; color:#9a3412;">Высокий</div>
                </div>
                <div style="flex:3; padding:8px; background:#f0fdf4; border-radius:8px; text-align:center;">
                  <div style="font-size:16px; font-weight:800; color:#16a34a;">3</div>
                  <div style="font-size:10px; color:#166534;">Средний</div>
                </div>
                <div style="flex:1; padding:8px; background:#f8fafc; border-radius:8px; text-align:center;">
                  <div style="font-size:16px; font-weight:800; color:#64748b;">1</div>
                  <div style="font-size:10px; color:#475569;">Низкий</div>
                </div>
              </div>

              <div class="sla-stat-row">
                <span>Соблюдение SLA:</span>
                <strong style="color:#10b981;">100% (норма &ge; 99,5%)</strong>
              </div>
              <div class="sla-stat-row">
                <span>Среднее время реакции:</span>
                <strong>18 мин</strong>
              </div>
              <div class="sla-stat-row">
                <span>Среднее время решения:</span>
                <strong>2 ч 47 мин</strong>
              </div>
              <div class="sla-stat-row">
                <span>Повторных инцидентов:</span>
                <strong>0</strong>
              </div>

              <div style="margin-top:20px; padding:12px; background:#f8fafc; border-radius:10px; font-size:12.5px; color:#475569;">
                Все критические обращения разрешены в регламентный срок первого приоритета.
              </div>
            </div>

            <!-- Card 3: Backups 100% -->
            <div class="glass-card">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
                <h3 style="font-size:16px; font-weight:700; color:#1e1b4b;">Резервные копии</h3>
                <span style="font-size:12px; color:#10b981; font-weight:600;">100% Успешно</span>
              </div>
              <div style="font-size:24px; font-weight:800; color:#10b981; margin-bottom:6px;">28 копий</div>

              <div style="font-size:13px; color:#64748b;">
                Ежедневные копии файлов, MySQL и ядра 1С-Битрикс
              </div>

              <!-- Daily Success Bars -->
              <div class="backup-bars-wrap">
                <div class="b-col"><div class="b-bar"></div><span class="b-label">25.05</span></div>
                <div class="b-col"><div class="b-bar"></div><span class="b-label">26.05</span></div>
                <div class="b-col"><div class="b-bar"></div><span class="b-label">27.05</span></div>
                <div class="b-col"><div class="b-bar"></div><span class="b-label">28.05</span></div>
                <div class="b-col"><div class="b-bar"></div><span class="b-label">29.05</span></div>
                <div class="b-col"><div class="b-bar"></div><span class="b-label">30.05</span></div>
                <div class="b-col"><div class="b-bar"></div><span class="b-label">31.05</span></div>
              </div>

              <div class="sla-stat-row">
                <span>Объём архивов:</span>
                <strong>1,42 ТБ</strong>
              </div>
              <div class="sla-stat-row">
                <span>Хранилище:</span>
                <strong>Beget Cloud S3</strong>
              </div>
              <div class="sla-stat-row">
                <span>Глубина хранения:</span>
                <strong>30 дней</strong>
              </div>
            </div>
          </div>

          <!-- Bottom Row (2 cards: Domains & SSL table + Hours Balance Speedometer) -->
          <div class="report-bottom-grid">
            <!-- Domains & SSL Table -->
            <div class="glass-card">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <div>
                  <h3 style="font-size:16px; font-weight:700; color:#1e1b4b;">Домены и сертификаты</h3>
                  <span style="font-size:12px; color:var(--text-secondary);">Домены: ${domainsList.length} &bull; Сертификаты SSL: активны</span>
                </div>
                <a href="javascript:void(0)" onclick="switchTab('domains')" style="font-size:13px; color:var(--primary-purple); font-weight:600; text-decoration:none;">
                  Показать все &rarr;
                </a>
              </div>

              <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <thead>
                  <tr style="border-bottom:1px solid #e2e8f0; color:#64748b; text-align:left;">
                    <th style="padding:8px 6px;">Сайт</th>
                    <th style="padding:8px 6px;">1С-Битрикс Админка</th>
                    <th style="padding:8px 6px;">SSL-сертификат</th>
                    <th style="padding:8px 6px;">Резервная копия</th>
                  </tr>
                </thead>
                <tbody>
                  ${domainsList.map(d => `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:10px 6px; font-weight:700; color:#1e1b4b;">
                        <a href="${d.url || 'https://' + d.fqdn}" target="_blank" style="color:#1e1b4b; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                          <span>${d.fqdn}</span>
                          <span style="font-size:11px; color:#64748b;">&nearr;</span>
                        </a>
                      </td>
                      <td style="padding:10px 6px;">
                        <a href="${d.bitrix_admin_url}" target="_blank" class="btn-bitrix-admin" style="font-size:11.5px; padding:5px 10px;">
                          <span>🔑</span>
                          <span>Вход в Битрикс &nearr;</span>
                        </a>
                      </td>
                      <td style="padding:10px 6px;">
                        ${d.ssl_status === 'active'
                          ? '<span class="badge-status-done" style="font-size:11px;">&check; Let\'s Encrypt</span>'
                          : '<span style="color:#94a3b8;">&mdash;</span>'}
                      </td>
                      <td style="padding:10px 6px; font-size:12px; color:#10b981; font-weight:600;">
                        &check; ${d.last_backup?.status || 'Актуален'} (${d.last_backup?.size_mb || 3840} МБ)
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Hours Balance Gauge Speedometer -->
            <div class="glass-card">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="font-size:16px; font-weight:700; color:#1e1b4b;">Баланс часов</h3>
                <span style="font-size:12px; color:#64748b;">Лимит: 140 ч</span>
              </div>

              <!-- Speedometer Semi-Circle SVG -->
              <div style="display:flex; flex-direction:column; align-items:center; margin: 12px 0;">
                <svg width="220" height="120" viewBox="0 0 200 110">
                  <!-- Background Track -->
                  <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" stroke-width="16" stroke-linecap="round"/>
                  <!-- Filled Track (83% used) -->
                  <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" stroke-width="16" stroke-linecap="round"
                    stroke-dasharray="251.32" stroke-dashoffset="42"/>
                  <!-- Needle Center -->
                  <circle cx="100" cy="100" r="8" fill="#1e1b4b"/>
                  <!-- Text in middle -->
                  <text x="100" y="85" text-anchor="middle" font-size="20" font-weight="800" fill="#1e1b4b">23,5 ч</text>
                  <text x="100" y="98" text-anchor="middle" font-size="9" font-weight="600" fill="#64748b">Остаток из 140 ч</text>
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stop-color="#10b981"/>
                      <stop offset="70%" stop-color="#8b5cf6"/>
                      <stop offset="100%" stop-color="#ec4899"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div class="sla-stat-row">
                <span>Использовано:</span>
                <strong>116,5 ч (83%)</strong>
              </div>
              <div class="sla-stat-row">
                <span>Запланировано:</span>
                <strong>0 ч (0%)</strong>
              </div>
              <div class="sla-stat-row">
                <span>Остаток:</span>
                <strong style="color:#10b981;">23,5 ч (17%)</strong>
              </div>

              <a href="javascript:void(0)" onclick="switchTab('report')" style="display:block; font-size:13px; color:var(--primary-purple); font-weight:600; text-decoration:none; margin-top:10px;">
                История баланса &rarr;
              </a>
            </div>
          </div>

          <!-- Bottom Action Buttons & Saby Signature Notification -->
          <div style="display:flex; justify-content:space-between; align-items:center; padding:18px 24px; background:rgba(255,255,255,0.7); border-radius:16px; border:1px solid var(--glass-border); flex-wrap:wrap; gap:16px;">
            <div style="font-size:13.5px; color:#475569;">
              <strong>Отчётность без лишних писем:</strong> данные обновляются автоматически через интеграции Beget и Saby.
            </div>
            <div style="display:flex; gap:12px;">
              <button class="btn-liquid-secondary" onclick="window.print()">
                📥 Скачать PDF
              </button>
              <button class="btn-liquid" onclick="generateSabyAct()">
                📑 Сформировать акт в СБИС
              </button>
            </div>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- TAB 4: ДОГОВОРЫ И СБИС                         -->
        <!-- ============================================== -->
        <div id="tab-saby" class="tab-pane" style="display: ${activeTab === 'saby' ? 'block' : 'none'};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
            <div>
              <h1 style="font-size: 26px; font-weight:800; color:#1e1b4b; margin-bottom:4px;">Договоры и документы Saby (СБИС)</h1>
              <p style="font-size: 14px; color:var(--text-secondary);">Электронный документооборот, акты выполненных работ и акты сверки взаиморасчетов</p>
            </div>
            <button class="btn-liquid" onclick="generateSabyAct()">
              + Сформировать новый акт
            </button>
          </div>

          <div class="glass-card" style="margin-bottom:24px;">
            <h3 style="font-size:17px; font-weight:700; color:#1e1b4b; margin-bottom:14px;">Основной договор обслуживания</h3>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:16px; font-size:14px;">
              <div>
                <span style="color:#64748b; font-size:12px;">Номер договора:</span><br>
                <strong>${contractNum}</strong>
              </div>
              <div>
                <span style="color:#64748b; font-size:12px;">ИНН контрагента:</span><br>
                <strong>${client.inn}</strong>
              </div>
              <div>
                <span style="color:#64748b; font-size:12px;">Статус в СБИС:</span><br>
                <span class="badge-status-done">&check; Действует (ЭДО)</span>
              </div>
              <div>
                <span style="color:#64748b; font-size:12px;">Абонентская плата:</span><br>
                <strong>45 000 ₽ / мес</strong>
              </div>
            </div>
          </div>

          <div class="glass-card">
            <h3 style="font-size:17px; font-weight:700; color:#1e1b4b; margin-bottom:14px;">Реестр документов СБИС</h3>
            <table style="width:100%; border-collapse:collapse; font-size:13.5px;">
              <thead>
                <tr style="border-bottom:1px solid #e2e8f0; color:#64748b; text-align:left;">
                  <th style="padding:10px 8px;">Тип</th>
                  <th style="padding:10px 8px;">Номер и дата</th>
                  <th style="padding:10px 8px;">Наименование</th>
                  <th style="padding:10px 8px;">Сумма / Сальдо</th>
                  <th style="padding:10px 8px;">Статус ЭДО</th>
                  <th style="padding:10px 8px; text-align:right;">Действия</th>
                </tr>
              </thead>
              <tbody id="saby-docs-table-body">
                ${sabyDocs.map(d => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:12px 8px;">
                      <span class="badge-status-done" style="font-size:11px;">
                        ${d.doc_type === 'act' ? 'Акт' : d.doc_type === 'contract' ? 'Договор' : d.doc_type === 'reconciliation' ? 'Сверка' : 'Счет'}
                      </span>
                    </td>
                    <td style="padding:12px 8px; font-weight:600;">${d.number}<br><span style="font-size:12px; color:#64748b; font-weight:normal;">${d.date}</span></td>
                    <td style="padding:12px 8px; color:#1e1b4b;">${d.title}</td>
                    <td style="padding:12px 8px; font-weight:600;">${d.amount}</td>
                    <td style="padding:12px 8px; color:#059669; font-size:12.5px;">${d.edo_status}</td>
                    <td style="padding:12px 8px; text-align:right;">
                      <a href="https://online.sbis.ru" target="_blank" class="btn-liquid-secondary" style="font-size:12px; padding:4px 10px;">
                        Открыть в СБИС &nearr;
                      </a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- TAB 5: РЕЗЕРВНЫЕ КОПИИ                         -->
        <!-- ============================================== -->
        <div id="tab-backups" class="tab-pane" style="display: ${activeTab === 'backups' ? 'block' : 'none'};">
          <div style="margin-bottom: 24px;">
            <h1 style="font-size: 26px; font-weight:800; color:#1e1b4b; margin-bottom:4px;">Резервные копии и защита 1С-Битрикс</h1>
            <p style="font-size: 14px; color:var(--text-secondary);">Автоматический аудит создания дампов баз данных MySQL и снимков файловой системы хостинга</p>
          </div>

          <div class="glass-card" style="margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
            <div>
              <div style="font-size:13px; color:var(--text-secondary);">Статус автоматического резервирования</div>
              <div style="font-size:22px; font-weight:800; color:#10b981; margin-top:2px;">🛡️ Все системы защищены на 100%</div>
              <div style="font-size:13px; color:#475569; margin-top:4px;">Хранилище: Защищенный кластер Beget S3 &bull; Архивы не занимают место на основном хостинге</div>
            </div>
            <div class="status-active-pill">
              <span class="status-dot-pulse"></span>
              Следующее создание: сегодня в 03:15
            </div>
          </div>

          <div class="glass-card">
            <h3 style="font-size:17px; font-weight:700; color:#1e1b4b; margin-bottom:14px;">Журнал резервных копий</h3>
            <table style="width:100%; border-collapse:collapse; font-size:13.5px;">
              <thead>
                <tr style="border-bottom:1px solid #e2e8f0; color:#64748b; text-align:left;">
                  <th style="padding:10px 8px;">Дата и время</th>
                  <th style="padding:10px 8px;">Сайт / Источник</th>
                  <th style="padding:10px 8px;">Размер архива</th>
                  <th style="padding:10px 8px;">Тип резервирования</th>
                  <th style="padding:10px 8px;">Статус</th>
                </tr>
              </thead>
              <tbody>
                ${backups.map(b => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:12px 8px; font-weight:600;">${b.backup_date}</td>
                    <td style="padding:12px 8px;"><strong>${b.site_name}</strong></td>
                    <td style="padding:12px 8px;">${b.size_mb} МБ</td>
                    <td style="padding:12px 8px; color:#64748b;">${b.source}</td>
                    <td style="padding:12px 8px;"><span class="badge-status-done">&check; ${b.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- TAB 6: САЙТЫ, 1С-БИТРИКС И МОНИТОРИНГ          -->
        <!-- ============================================== -->
        <div id="tab-domains" class="tab-pane" style="display: ${activeTab === 'domains' ? 'block' : 'none'};">
          <div style="margin-bottom: 24px;">
            <h1 style="font-size: 26px; font-weight:800; color:#1e1b4b; margin-bottom:4px;">Сайты, управление 1С-Битрикс и Мониторинг</h1>
            <p style="font-size: 14px; color:var(--text-secondary);">Обслуживаемые сайты компании, быстрый вход в административную панель 1С-Битрикс, статус доступности и резервных копий</p>
          </div>

          <!-- Cards Grid for Monitored Sites -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px; margin-bottom: 24px;">
            ${domainsList.map(d => `
              <div class="glass-card" style="display:flex; flex-direction:column; justify-content:space-between; border-top: 3px solid #dc2626;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                    <div>
                      <div style="font-size: 18px; font-weight: 800; color: #1e1b4b; word-break: break-all;">
                        ${d.fqdn}
                      </div>
                      <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 2px;">
                        Платформа: <strong style="color:#0f172a;">${d.cms || '1С-Битрикс'}</strong> (${d.cms_version || '24.100.0'}, PHP ${d.php_version || '8.2'})
                      </div>
                    </div>
                    <span class="badge-status-done" style="font-size:11px; white-space:nowrap;">
                      <span style="display:inline-block; width:6px; height:6px; background:#10b981; border-radius:50%; margin-right:4px;"></span>
                      Онлайн 200 OK
                    </span>
                  </div>

                  <div style="background: rgba(248,250,252,0.8); border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 16px; font-size: 13px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                      <span style="color: #64748b;">SSL-сертификат:</span>
                      <strong style="color: #10b981;">&check; Let's Encrypt (TLS 1.3)</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                      <span style="color: #64748b;">Резервная копия:</span>
                      <strong style="color: #1e1b4b;">&check; ${d.last_backup?.status || 'Успешно'} (${d.last_backup?.size_mb || 3840} МБ)</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                      <span style="color: #64748b;">Дата последнего бэкапа:</span>
                      <span style="color: #475569; font-weight: 600;">${d.last_backup?.date || 'Сегодня 03:15'}</span>
                    </div>
                  </div>
                </div>

                <!-- Action Buttons: Site Link + Bitrix Admin Link -->
                <div style="display: flex; gap: 10px; flex-wrap: wrap; pt: 10px; border-top: 1px solid #f1f5f9;">
                  <a href="${d.bitrix_admin_url}" target="_blank" class="btn-bitrix-admin" style="flex: 1; justify-content: center;">
                    <span>🔑</span>
                    <span>Панель 1С-Битрикс &nearr;</span>
                  </a>
                  <a href="${d.url || 'https://' + d.fqdn}" target="_blank" class="btn-site-visit" style="flex: 1; justify-content: center;">
                    <span>🌐</span>
                    <span>Открыть сайт &nearr;</span>
                  </a>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Detailed Monitoring Table -->
          <div class="glass-card">
            <h3 style="font-size:17px; font-weight:700; color:#1e1b4b; margin-bottom:14px;">Сводная таблица параметров и быстрый переход</h3>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="border-bottom:1px solid #e2e8f0; color:#64748b; text-align:left;">
                  <th style="padding:10px 8px;">Сайт компании</th>
                  <th style="padding:10px 8px;">Вход в 1С-Битрикс</th>
                  <th style="padding:10px 8px;">CMS / Стек</th>
                  <th style="padding:10px 8px;">Статус SSL</th>
                  <th style="padding:10px 8px;">Резервное копирование</th>
                  <th style="padding:10px 8px; text-align:right;">Доступность</th>
                </tr>
              </thead>
              <tbody>
                ${domainsList.map(d => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:12px 8px; font-weight:700; color:#1e1b4b;">
                      <a href="${d.url || 'https://' + d.fqdn}" target="_blank" style="color:#1e1b4b; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
                        <span>${d.fqdn}</span>
                        <span style="font-size:11px; color:#64748b;">&nearr;</span>
                      </a>
                    </td>
                    <td style="padding:12px 8px;">
                      <a href="${d.bitrix_admin_url}" target="_blank" class="btn-bitrix-admin" style="font-size:12px; padding:6px 12px;">
                        <span>🔑</span>
                        <span>Вход в Битрикс &nearr;</span>
                      </a>
                    </td>
                    <td style="padding:12px 8px; color:#475569;">
                      <strong>${d.cms || '1С-Битрикс'}</strong> <span style="font-size:11px; color:#64748b;">(${d.php_version || '8.2'})</span>
                    </td>
                    <td style="padding:12px 8px;">
                      ${d.ssl_status === 'active'
                        ? '<span class="badge-status-done">&check; TLS 1.3 Let\'s Encrypt</span>'
                        : '<span style="color:#94a3b8;">Не подключен</span>'}
                    </td>
                    <td style="padding:12px 8px; font-size:12.5px; color:#10b981; font-weight:600;">
                      &check; ${d.last_backup?.status || 'Успешно'} (${d.last_backup?.size_mb || 3840} МБ)
                    </td>
                    <td style="padding:12px 8px; text-align:right;">
                      <span class="badge-status-done" style="font-size:11px;">200 OK (~${d.response_time_ms || 145}мс)</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  </div>

  <!-- MODAL: + Открыть обращение (Mockup 1) -->
  <div id="ticket-modal" class="modal-overlay">
    <div class="modal-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
        <h3 style="font-size:18px; font-weight:800; color:#1e1b4b;">Новое обращение в техподдержку</h3>
        <button onclick="closeTicketModal()" style="background:none; border:none; font-size:22px; cursor:pointer; color:#94a3b8;">&times;</button>
      </div>
      <p style="font-size:13.5px; color:#64748b; margin-bottom:16px;">
        Ваше обращение будет моментально зафиксировано в журнале сервиса со статусом «В работе» и SLA реакцией до 18 минут.
      </p>

      <form id="ticket-form" onsubmit="submitTicket(event)">
        <div class="form-group">
          <label>Тема обращения:</label>
          <input type="text" id="t-subject" placeholder="Например: Не отправляются письма с сайта" required>
        </div>

        <div class="form-group">
          <label>Услуга / Категория:</label>
          <select id="t-service">
            <option value="Техническая поддержка">Техническая поддержка</option>
            <option value="1С-Битрикс и доработки">1С-Битрикс и доработки</option>
            <option value="Инфраструктура и сервер">Инфраструктура и сервер</option>
            <option value="SSL-сертификаты и почта">SSL-сертификаты и почта</option>
            <option value="Резервное копирование">Резервное копирование</option>
          </select>
        </div>

        <div class="form-group">
          <label>Приоритет:</label>
          <select id="t-priority">
            <option value="medium">Стандартный (реакция до 18 мин)</option>
            <option value="high">Высокий (блокирует работу)</option>
            <option value="low">Консультация / пожелание</option>
          </select>
        </div>

        <div class="form-group">
          <label>Подробное описание:</label>
          <textarea id="t-message" rows="3" placeholder="Опишите подробности задачи или приложите текст ошибки..."></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:20px;">
          <button type="button" class="btn-liquid-secondary" onclick="closeTicketModal()">Отмена</button>
          <button type="submit" class="btn-liquid">Отправить в работу &rarr;</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const clientId = ${client.id};

    function switchTab(tabId) {
      document.querySelectorAll('.tab-pane').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

      const target = document.getElementById('tab-' + tabId);
      if (target) {
        target.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // highlight nav link
      const links = document.querySelectorAll('.nav-link');
      links.forEach(l => {
        if (l.getAttribute('onclick') && l.getAttribute('onclick').includes(tabId)) {
          l.classList.add('active');
        }
      });
    }

    function filterEvents(cat, btn) {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');

      const cards = document.querySelectorAll('.event-card');
      cards.forEach(c => {
        if (cat === 'all' || c.getAttribute('data-cat') === cat) {
          c.style.display = 'flex';
        } else {
          c.style.display = 'none';
        }
      });
    }

    function openTicketModal() {
      document.getElementById('ticket-modal').classList.add('open');
    }
    function closeTicketModal() {
      document.getElementById('ticket-modal').classList.remove('open');
    }

    async function submitTicket(e) {
      e.preventDefault();
      const subject = document.getElementById('t-subject').value;
      const service = document.getElementById('t-service').value;
      const priority = document.getElementById('t-priority').value;
      const message = document.getElementById('t-message').value;

      try {
        const res = await fetch('/api/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            subject,
            service,
            priority,
            message,
            contactId: ${contact ? contact.id : 'null'},
            authorName: ${JSON.stringify(contact ? contact.name : 'Представитель клиента')},
            authorEmail: ${JSON.stringify(contact ? contact.email : '')},
            authorPosition: ${JSON.stringify(contact ? contact.position : '')}
          })
        });
        const data = await res.json();
        if (data.ok) {
          closeTicketModal();
          alert('✅ Обращение ' + (data.ticket?.ticket_number || '') + ' успешно зарегистрировано в системе! Инженер уже оповещен.');
          window.location.reload();
        } else {
          alert('Ошибка: ' + (data.error || 'Не удалось создать обращение'));
        }
      } catch (err) {
        alert('Ошибка при отправке обращения: ' + err.message);
      }
    }

    async function generateSabyAct() {
      if (!confirm('Сформировать акт выполненных работ за Май 2026 в системе Saby (СБИС)?')) return;
      try {
        const res = await fetch('/api/saby_act', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, monthName: 'Май 2026', amount: 45000 })
        });
        const data = await res.json();
        if (data.ok) {
          alert('✅ Акт ' + data.doc.number + ' успешно сформирован и подготовлен к отправке в СБИС ЭДО!');
          switchTab('saby');
          window.location.reload();
        }
      } catch (err) {
        alert('Ошибка при формировании акта в СБИС');
      }
    }
  </script>
</body>
</html>`;
}

// --------------------------------------------------------------------------
// 2FA LOGIN PAGE (Step 1: Contact selects Email or Secret Token)
// --------------------------------------------------------------------------
export function renderPortalLoginPage({ error = null, message = null, initialEmail = '' } = {}) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Вход в Личный кабинет — Клиентский портал | Klimov CRM</title>
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 10% 20%, rgba(235, 238, 255, 0.9) 0%, rgba(244, 240, 255, 0.8) 50%, rgba(247, 249, 254, 0.95) 100%);
      --glass-bg: rgba(255, 255, 255, 0.82);
      --glass-border: rgba(255, 255, 255, 0.9);
      --glass-shadow: 0 16px 40px 0 rgba(31, 38, 135, 0.08), 0 4px 12px 0 rgba(0, 0, 0, 0.03);
      --primary-purple: #6d28d9;
      --primary-gradient: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      --text-main: #1e1b4b;
      --text-secondary: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: var(--bg-gradient);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: var(--text-main);
    }
    .auth-card {
      width: 100%;
      max-width: 480px;
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      padding: 36px 32px;
      box-shadow: var(--glass-shadow);
    }
    .brand-header {
      text-align: center;
      margin-bottom: 28px;
    }
    .brand-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 26px;
      box-shadow: 0 8px 20px rgba(124, 58, 237, 0.3);
      margin-bottom: 14px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .brand-sub {
      font-size: 13.5px;
      color: var(--text-secondary);
      line-height: 1.45;
    }
    .auth-tabs {
      display: flex;
      background: rgba(241, 245, 249, 0.8);
      border-radius: 12px;
      padding: 4px;
      margin-bottom: 24px;
    }
    .auth-tab-btn {
      flex: 1;
      padding: 10px;
      border: none;
      background: transparent;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .auth-tab-btn.active {
      background: #ffffff;
      color: #6d28d9;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      font-weight: 700;
    }
    .form-group {
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 6px;
    }
    input[type="text"], input[type="email"] {
      width: 100%;
      padding: 12px 14px;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      font-size: 14px;
      color: #0f172a;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input[type="text"]:focus, input[type="email"]:focus {
      border-color: #7c3aed;
      box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
    }
    .btn-submit {
      width: 100%;
      padding: 13px;
      background: var(--primary-gradient);
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 14.5px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);
      transition: all 0.2s ease;
    }
    .btn-submit:hover {
      background: linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%);
      transform: translateY(-1px);
    }
    .security-notice {
      margin-top: 24px;
      padding: 12px 14px;
      background: rgba(241, 245, 249, 0.7);
      border-radius: 10px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .alert-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      margin-bottom: 20px;
      line-height: 1.4;
      text-align: left;
    }
    .alert-success {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="auth-card">
    <div class="brand-header">
      <div class="brand-icon">🛡️</div>
      <h1>Закрытый личный кабинет</h1>
      <div class="brand-sub">IT-сопровождение, мониторинг сайтов и акты СБИС | Евгений Климов</div>
    </div>

    ${error ? `<div class="alert-error">⚠️ ${error}</div>` : ''}
    ${message ? `<div class="alert-success">✓ ${message}</div>` : ''}

    <div class="auth-tabs">
      <button type="button" class="auth-tab-btn active" id="tab-btn-email" onclick="showTab('email')">
        ✉️ По рабочей почте
      </button>
      <button type="button" class="auth-tab-btn" id="tab-btn-token" onclick="showTab('token')">
        🔑 По секретной ссылке
      </button>
    </div>

    <!-- Email Tab -->
    <form id="form-email" action="/portal/send_code" method="POST">
      <div class="form-group">
        <label for="inp-email">Рабочая электронная почта представителя:</label>
        <input type="email" id="inp-email" name="email" required placeholder="director@alpha-service.pro" value="${initialEmail}">
        <div style="font-size: 11.5px; color: #64748b; margin-top: 5px;">
          На указанную почту поступит одноразовый 6-значный код подтверждения
        </div>
      </div>
      <button type="submit" class="btn-submit">
        Получить проверочный код &rarr;
      </button>
    </form>

    <!-- Token Tab -->
    <form id="form-token" action="/portal/send_code" method="POST" style="display: none;">
      <div class="form-group">
        <label for="inp-token">Секретная ссылка или персональный ключ:</label>
        <input type="text" id="inp-token" name="token" placeholder="sec_alpha_dir_8f29d10e или ссылка целиком">
        <div style="font-size: 11.5px; color: #64748b; margin-top: 5px;">
          Вставьте индивидуальную ссылку, выданную вашим инженером
        </div>
      </div>
      <button type="submit" class="btn-submit">
        Продолжить вход &rarr;
      </button>
    </form>

    <div class="security-notice">
      <span style="font-size: 18px;">🔒</span>
      <div>
        <strong>Двухфакторная защита данных:</strong> Личный кабинет содержит финансовую информацию, закрывающие документы СБИС и параметры хостинга. Доступ предоставляется только авторизованным контактным лицам компаний.
      </div>
    </div>

    <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
      Вопросы по доступу: <a href="mailto:info@e-klimov.ru" style="color: #6d28d9; text-decoration: none; font-weight: 600;">info@e-klimov.ru</a> | +7 (921) 980-44-12
    </div>
  </div>

  <script>
    function showTab(type) {
      if (type === 'email') {
        document.getElementById('form-email').style.display = 'block';
        document.getElementById('form-token').style.display = 'none';
        document.getElementById('tab-btn-email').classList.add('active');
        document.getElementById('tab-btn-token').classList.remove('active');
      } else {
        document.getElementById('form-email').style.display = 'none';
        document.getElementById('form-token').style.display = 'block';
        document.getElementById('tab-btn-email').classList.remove('active');
        document.getElementById('tab-btn-token').classList.add('active');
      }
    }
  </script>
</body>
</html>`;
}

// --------------------------------------------------------------------------
// 2FA VERIFICATION PAGE (Step 2: 6-digit OTP code verification)
// --------------------------------------------------------------------------
export function renderPortalVerifyPage({ contact, client, token = '', error = null, simulatedCode = null }) {
  const maskEmail = (email) => {
    if (!email) return '';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) return name[0] + '***@' + domain;
    return name[0] + '•••••' + name.slice(-1) + '@' + domain;
  };

  const maskedEmail = maskEmail(contact.email);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Подтверждение входа — ${client.company_name} | Klimov CRM</title>
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 10% 20%, rgba(235, 238, 255, 0.9) 0%, rgba(244, 240, 255, 0.8) 50%, rgba(247, 249, 254, 0.95) 100%);
      --glass-bg: rgba(255, 255, 255, 0.85);
      --glass-border: rgba(255, 255, 255, 0.9);
      --glass-shadow: 0 16px 40px 0 rgba(31, 38, 135, 0.08), 0 4px 12px 0 rgba(0, 0, 0, 0.03);
      --primary-gradient: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
      --text-main: #1e1b4b;
      --text-secondary: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: var(--bg-gradient);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: var(--text-main);
    }
    .verify-card {
      width: 100%;
      max-width: 480px;
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      padding: 36px 32px;
      box-shadow: var(--glass-shadow);
      text-align: center;
    }
    .shield-badge {
      width: 60px;
      height: 60px;
      background: #ede9fe;
      color: #7c3aed;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin-bottom: 16px;
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.15);
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .user-target-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      margin: 18px 0;
      text-align: left;
      font-size: 13px;
      line-height: 1.5;
    }
    .user-target-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .user-target-label {
      color: #64748b;
    }
    .user-target-val {
      font-weight: 700;
      color: #1e293b;
    }
    .code-input-wrapper {
      margin: 22px 0;
    }
    .code-input {
      width: 100%;
      max-width: 300px;
      padding: 12px 10px;
      background: #ffffff;
      border: 2px solid #7c3aed;
      border-radius: 12px;
      font-size: 30px;
      font-weight: 800;
      font-family: monospace;
      letter-spacing: 10px;
      text-align: center;
      color: #0f172a;
      outline: none;
      box-shadow: 0 4px 16px rgba(124, 58, 237, 0.12);
    }
    .btn-verify {
      width: 100%;
      padding: 14px;
      background: var(--primary-gradient);
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);
      transition: all 0.2s ease;
    }
    .btn-verify:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(124, 58, 237, 0.4);
    }
    .alert-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding: 12px;
      border-radius: 10px;
      font-size: 13px;
      margin-bottom: 16px;
      line-height: 1.4;
      text-align: left;
    }
    .simulated-banner {
      background: #eff6ff;
      border: 1px dashed #3b82f6;
      border-radius: 10px;
      padding: 12px;
      font-size: 12px;
      color: #1e40af;
      margin-top: 18px;
      line-height: 1.4;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="verify-card">
    <div class="shield-badge">🔐</div>
    <h1>Подтверждение личности</h1>
    <p style="font-size: 13.5px; color: var(--text-secondary); margin-top: 4px;">
      Мы отправили одноразовый проверочный код на вашу рабочую почту
    </p>

    <div class="user-target-box">
      <div class="user-target-row">
        <span class="user-target-label">Организация:</span>
        <span class="user-target-val">${client.company_name}</span>
      </div>
      <div class="user-target-row">
        <span class="user-target-label">Контактное лицо:</span>
        <span class="user-target-val">${contact.name}</span>
      </div>
      <div class="user-target-row">
        <span class="user-target-label">Должность:</span>
        <span class="user-target-val">${contact.position || 'Представитель'}</span>
      </div>
      <div class="user-target-row" style="margin-bottom: 0;">
        <span class="user-target-label">Email для кода:</span>
        <span class="user-target-val" style="color: #6d28d9;">${maskedEmail}</span>
      </div>
    </div>

    ${error ? `<div class="alert-error">⚠️ ${error}</div>` : ''}

    <form action="/portal/do_verify" method="POST">
      <input type="hidden" name="contact_id" value="${contact.id}">
      <input type="hidden" name="token" value="${token}">

      <div class="code-input-wrapper">
        <label style="display: block; font-size: 12.5px; font-weight: 600; color: #475569; margin-bottom: 8px;">
          Введите 6-значный проверочный код:
        </label>
        <input type="text" name="code" class="code-input" maxlength="6" pattern="[0-9]{6}" required autofocus placeholder="••••••" autocomplete="one-time-code">
      </div>

      <button type="submit" class="btn-verify">
        Войти в Личный кабинет &rarr;
      </button>
    </form>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; font-size: 12.5px;">
      <form action="/portal/send_code" method="POST" style="display: inline;">
        <input type="hidden" name="email" value="${contact.email}">
        <button type="submit" style="background: none; border: none; color: #6d28d9; cursor: pointer; text-decoration: underline; font-size: 12.5px; font-weight: 600;">
          Отправить код повторно
        </button>
      </form>
      <a href="/portal/login" style="color: #64748b; text-decoration: none;">Войти другим контактом</a>
    </div>
  </div>
</body>
</html>`;
}

