import fs from 'fs';
let code = fs.readFileSync('src/views/admin_view.js', 'utf8');

// 1. Fix modal overlay CSS
code = code.replace(
  /\.modal-overlay \{\s*position: fixed;\s*inset: 0;\s*background: rgba\(15, 23, 42, 0\.4\);\s*backdrop-filter: blur\(8px\);\s*display: none;\s*align-items: center;\s*justify-content: center;\s*z-index: 100;\s*padding: 20px;\s*\}/,
  `.modal-overlay {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(8px);
      display: none; align-items: flex-start; justify-content: center; z-index: 100; padding: 20px; overflow-y: auto;
    }`
);

// 2. Fix modal card CSS
code = code.replace(
  /\.modal-card \{\s*background: #ffffff;\s*border-radius: 20px;\s*box-shadow: 0 24px 60px rgba\(0, 0, 0, 0\.2\);\s*width: 100%;\s*max-width: 580px;\s*padding: 28px;\s*position: relative;\s*\}/,
  `.modal-card {
      background: #ffffff; border-radius: 20px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
      width: 100%; max-width: 580px; padding: 28px; position: relative; box-sizing: border-box; margin: auto;
    }`
);

// 3. Update tabs-bar for mobile
const tabsCssRegex = /\.tabs-bar \{([^}]+)\}/;
code = code.replace(tabsCssRegex, `.tabs-bar {$1}
    .mobile-menu-toggle { display: none; background: #ffffff; border: 1px solid #cbd5e1; padding: 12px 16px; border-radius: 12px; margin-bottom: 12px; font-weight: 700; color: #1e1b4b; cursor: pointer; text-align: left; width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    @media (max-width: 768px) {
      .tabs-bar { flex-direction: column; padding: 12px; display: none; }
      .tabs-bar.show { display: flex; }
      .tab-btn { justify-content: flex-start; width: 100%; padding: 14px 16px; border-bottom: 1px solid #f1f5f9; }
      .mobile-menu-toggle { display: flex; justify-content: space-between; align-items: center; }
    }
`);

// 4. Inject mobile menu toggle button in HTML before tabs
const tabsHtml = `<div class="tabs-bar" id="mobile-tabs-menu">`;
const toggleHtml = `
    <button class="mobile-menu-toggle" onclick="document.getElementById('mobile-tabs-menu').classList.toggle('show')">
      <span>🍔 Меню навигации</span>
      <span>▼</span>
    </button>
    <div class="tabs-bar" id="mobile-tabs-menu">`;
code = code.replace('<div class="tabs-bar">', toggleHtml);

// 5. Favicon and Logo in admin_view
code = code.replace('<head>', '<head>\n  <link rel="icon" href="/photo_2026-09-14_14-16-17.jpg">');
// Find company-avatar and replace with the image logo if we can.
code = code.replace(
  '<div class="company-avatar">',
  '<div class="company-avatar" style="background: url(/photo_2026-09-14_14-16-17.jpg) center/cover no-repeat; color: transparent; border: 2px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">'
);

fs.writeFileSync('src/views/admin_view.js', code);
