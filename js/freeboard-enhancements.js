/* jshint esversion: 6 */
/**
 * freeboard-enhancements.js — Freeboard Pro UI enhancements
 *
 * Self-contained, vanilla JS. No external dependencies.
 * Additive only — does not modify or break existing freeboard.js.
 *
 * Modules:
 *  - FBThemeManager  : dark/light theme with localStorage persistence
 *  - FBClock         : live clock/date display in the nav bar
 *  - FBSidebar       : collapsible sidebar toggle
 *  - FBNotifications : in-memory alert list with dropdown UI
 *  - FBPages         : named dashboard pages (pane config slots)
 *  - FBStatusBar     : periodic status bar updates
 */

'use strict';

/* ── Theme Manager ───────────────────────────────────────── */
const FBThemeManager = {
  STORAGE_KEY: 'fb-theme',
  DEFAULT: 'theme-dark',

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY) || this.DEFAULT;
    this.apply(saved);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => this.toggle());
    }
  },

  toggle() {
    const current = document.body.classList.contains('theme-light')
      ? 'theme-light'
      : 'theme-dark';
    const next = current === 'theme-dark' ? 'theme-light' : 'theme-dark';
    this.apply(next);
    localStorage.setItem(this.STORAGE_KEY, next);
  },

  apply(theme) {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(theme);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = theme === 'theme-dark' ? '☀️' : '🌙';
      btn.title = theme === 'theme-dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme';
    }
  }
};

/* ── Live Clock ──────────────────────────────────────────── */
const FBClock = {
  init() {
    this._tick();
    setInterval(() => this._tick(), 1000);
  },

  _tick() {
    const el = document.getElementById('fb-clock');
    if (!el) return;
    const now = new Date();
    const date = now.toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit'
    });
    const time = now.toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    el.textContent = `${date}  ${time}`;
  }
};

/* ── Sidebar Toggle ──────────────────────────────────────── */
const FBSidebar = {
  STORAGE_KEY: 'fb-sidebar-collapsed',

  init() {
    // Restore saved state
    if (localStorage.getItem(this.STORAGE_KEY) === 'true') {
      document.body.classList.add('sidebar-collapsed');
    }

    const btn = document.getElementById('sidebar-toggle');
    if (btn) {
      btn.addEventListener('click', () => this.toggle());
    }
  },

  toggle() {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem(this.STORAGE_KEY, collapsed ? 'true' : 'false');
  }
};

/* ── Notifications Manager ───────────────────────────────── */
const FBNotifications = {
  MAX_ALERTS: 50,
  alerts: [],

  /**
   * Add a new alert.
   * @param {string} message
   * @param {'info'|'warning'|'error'} type
   */
  add(message, type) {
    type = type || 'info';
    this.alerts.unshift({
      message,
      type,
      time: new Date().toLocaleTimeString()
    });
    // Keep max items
    if (this.alerts.length > this.MAX_ALERTS) this.alerts.pop();
    this.render();
  },

  render() {
    const list  = document.getElementById('fb-notif-list');
    const badge = document.getElementById('fb-notif-badge');
    if (!list || !badge) return;

    list.innerHTML = this.alerts.length
      ? this.alerts.map(a =>
          `<div class="fb-notif-item ${a.type}">
             <strong>${a.time}</strong> — ${_escapeHtml(a.message)}
           </div>`
        ).join('')
      : '<div style="padding:10px 14px;font-size:0.8rem;color:var(--fb-text-secondary)">No notifications</div>';

    const count = this.alerts.length;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('hidden', count === 0);
  },

  clear() {
    this.alerts = [];
    this.render();
  },

  _initToggle() {
    const btn      = document.getElementById('fb-notif-btn');
    const dropdown = document.getElementById('fb-notif-dropdown');
    const clearBtn = document.getElementById('fb-notif-clear');

    if (btn && dropdown) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      });
      document.addEventListener('click', () => {
        if (dropdown) dropdown.classList.add('hidden');
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clear());
    }
  }
};

/* ── Dashboard Pages ─────────────────────────────────────── */
const FBPages = {
  STORAGE_KEY: 'fb-pages',
  pages: {},
  currentPage: 'default',

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try { this.pages = JSON.parse(saved); } catch (e) { this.pages = {}; }
    }
    if (!this.pages['default']) {
      this.pages['default'] = { name: 'default', panes: null };
    }
    this.renderPageList();

    const addBtn = document.getElementById('btn-add-page');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const name = prompt('Enter page name:');
        if (name && name.trim()) this.addPage(name.trim());
      });
    }
  },

  addPage(name) {
    if (this.pages[name]) return;
    this.pages[name] = { name, panes: null };
    this._save();
    this.renderPageList();
    FBNotifications.add(`Page "${name}" created`, 'info');
  },

  switchPage(name) {
    if (!this.pages[name]) return;
    this.currentPage = name;
    this.renderPageList();
    FBNotifications.add(`Switched to page "${name}"`, 'info');
  },

  saveCurrent() {
    this._save();
  },

  renderPageList() {
    const container = document.getElementById('fb-page-list');
    if (!container) return;
    container.innerHTML = Object.keys(this.pages).map(key => {
      const isActive = key === this.currentPage;
      return `<div class="fb-page-item${isActive ? ' active' : ''}"
                   data-page="${_escapeHtml(key)}"
                   title="Switch to ${_escapeHtml(key)}">
                📄 ${_escapeHtml(key)}
              </div>`;
    }).join('');

    container.querySelectorAll('.fb-page-item').forEach(el => {
      el.addEventListener('click', () => this.switchPage(el.dataset.page));
    });
  },

  _save() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.pages));
  }
};

/* ── Status Bar Updater ──────────────────────────────────── */
const FBStatusBar = {
  init() {
    this._update();
    setInterval(() => this._update(), 5000);
  },

  _update() {
    // Try to read datasource count from freeboard if available
    let dsCount = 0;
    try {
      if (window.freeboard && typeof window.freeboard.getDatasourceCount === 'function') {
        dsCount = window.freeboard.getDatasourceCount();
      } else {
        // Count rows in the datasources table as a fallback
        const rows = document.querySelectorAll('#datasources-list tbody tr');
        dsCount = rows.length;
      }
    } catch (e) { /* ignore */ }

    const connected = navigator.onLine !== false;
    const lastUpdate = new Date().toLocaleTimeString();
    this.update(dsCount, lastUpdate, connected);
  },

  update(datasourceCount, lastUpdate, connected) {
    const dsEl   = document.getElementById('fb-status-datasources');
    const timeEl = document.getElementById('fb-status-updated');
    const connEl = document.getElementById('fb-status-connection');

    if (dsEl)   dsEl.textContent   = `● ${datasourceCount} datasource${datasourceCount !== 1 ? 's' : ''}`;
    if (timeEl) timeEl.textContent = `Last updated: ${lastUpdate}`;
    if (connEl) {
      connEl.textContent = connected ? '● Connected' : '● Disconnected';
      connEl.className   = connected ? 'status-connected' : 'status-disconnected';
    }
  }
};

/* ── Internal helper ─────────────────────────────────────── */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Expose globals ──────────────────────────────────────── */
window.FBThemeManager  = FBThemeManager;
window.FBClock         = FBClock;
window.FBSidebar       = FBSidebar;
window.FBNotifications = FBNotifications;
window.FBPages         = FBPages;
window.FBStatusBar     = FBStatusBar;

/* ── Bootstrap on DOM ready ──────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  FBThemeManager.init();
  FBClock.init();
  FBSidebar.init();
  FBNotifications._initToggle();
  FBNotifications.render();
  FBPages.init();
  FBStatusBar.init();
});
