window.router = {
  currentView: 'dashboard',
  currentParams: {},
  viewContainer: null,
  viewTitleEl: null,
  viewSubEl: null,

  viewMeta: {
    dashboard: { title: 'Dashboard', sub: 'Your financial overview' },
    accounts: { title: 'Accounts', sub: 'Manage your bank, credit, and investment accounts' },
    ledger: { title: 'Transactions', sub: '' },
    budget: { title: 'Budget', sub: 'Plan and track monthly spending' },
    investments: { title: 'Investments', sub: 'Track holdings and portfolio performance' },
    reports: { title: 'Reports', sub: 'Spending trends and net worth over time' },
    categories: { title: 'Categories', sub: 'Organize income and expense categories' },
  },

  init() {
    this.viewContainer = document.getElementById('view-content');
    this.viewTitleEl = document.getElementById('view-title');
    this.viewSubEl = document.getElementById('view-subtitle');

    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => this.navigate(item.dataset.view));
    });

    this.navigate('dashboard');
  },

  async navigate(viewName, params = {}) {
    this.currentView = viewName;
    this.currentParams = params;
    window.appState.currentView = viewName;

    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    const meta = this.viewMeta[viewName] || { title: viewName, sub: '' };
    this.viewTitleEl.textContent = meta.title;

    if (viewName === 'ledger' && params.accountId) {
      await window.appState.refreshAccounts();
      const account = window.appState.getAccount(params.accountId);
      this.viewSubEl.textContent = account ? `${window.fmt.accountTypeLabel(account.type)} \u00b7 ${window.fmt.signedCurrency(account.balance)}` : '';
    } else {
      this.viewSubEl.textContent = meta.sub;
    }

    const view = window.views[viewName];
    if (!view) {
      this.viewContainer.innerHTML = `<div class="empty-state"><h3>View not found</h3></div>`;
      return;
    }

    try {
      await view.render(this.viewContainer, params);
    } catch (err) {
      console.error('View render error:', err);
      this.viewContainer.innerHTML = `
        <div class="empty-state">
          <h3>Something went wrong loading this view</h3>
          <p>${window.fmt.escapeHtml(err.message)}</p>
        </div>
      `;
    }

    await this.renderSidebarAccounts();
  },

  async refreshCurrentView() {
    await this.navigate(this.currentView, this.currentParams);
  },

  async renderSidebarAccounts() {
    const container = document.getElementById('sidebar-accounts');
    if (!container) return;
    const accounts = await window.appState.refreshAccounts();

    if (accounts.length === 0) {
      container.innerHTML = `<div style="padding: var(--space-2) var(--space-5); font-size: var(--text-xs); color: rgba(244,242,234,0.4);">No accounts yet</div>`;
      return;
    }

    container.innerHTML = accounts.map(a => `
      <div class="account-list-item ${this.currentView === 'ledger' && this.currentParams.accountId === a.id ? 'active' : ''}" data-account-id="${a.id}">
        <span class="acct-name">${window.fmt.escapeHtml(a.name)}</span>
        <span class="acct-balance ${a.balance < 0 ? 'negative' : ''}">${window.fmt.signedCurrency(a.balance)}</span>
      </div>
    `).join('');

    container.querySelectorAll('.account-list-item').forEach(item => {
      item.addEventListener('click', () => {
        this.navigate('ledger', { accountId: Number(item.dataset.accountId) });
      });
    });
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.appState.refreshAll();
  } catch (err) {
    console.error('Initial data load failed:', err);
  }
  window.router.init();
});
