// Central app state: caches reference data (accounts, categories, payees) used across views.

window.appState = {
  accounts: [],
  categories: [],
  categoriesTree: [],
  payees: [],
  currentView: 'dashboard',
  currentAccountId: null,

  async refreshAccounts() {
    this.accounts = await window.ui.callApi(window.api.accounts.list({ includeClosed: false }));
    return this.accounts;
  },

  async refreshCategories() {
    this.categories = await window.ui.callApi(window.api.categories.list());
    this.categoriesTree = await window.ui.callApi(window.api.categories.tree());
    return this.categories;
  },

  async refreshPayees() {
    this.payees = await window.ui.callApi(window.api.payees.list());
    return this.payees;
  },

  async refreshAll() {
    await Promise.all([this.refreshAccounts(), this.refreshCategories(), this.refreshPayees()]);
  },

  getAccount(id) {
    return this.accounts.find(a => a.id === id);
  },

  expenseCategories() {
    return this.categories.filter(c => c.type === 'expense');
  },

  incomeCategories() {
    return this.categories.filter(c => c.type === 'income');
  },

  categoryOptionsHtml(selectedId, { includeBlank = true } = {}) {
    const renderNode = (node, depth) => {
      const indent = '\u2014 '.repeat(depth); // em-dash indent for subcategories
      let html = `<option value="${node.id}" ${node.id === selectedId ? 'selected' : ''}>${indent}${window.fmt.escapeHtml(node.name)}</option>`;
      for (const child of node.children || []) {
        html += renderNode(child, depth + 1);
      }
      return html;
    };

    let html = includeBlank ? '<option value="">(Uncategorized)</option>' : '';
    const incomeRoots = this.categoriesTree.filter(c => c.type === 'income');
    const expenseRoots = this.categoriesTree.filter(c => c.type === 'expense');

    if (incomeRoots.length) {
      html += '<optgroup label="Income">';
      for (const root of incomeRoots) html += renderNode(root, 0);
      html += '</optgroup>';
    }
    if (expenseRoots.length) {
      html += '<optgroup label="Expense">';
      for (const root of expenseRoots) html += renderNode(root, 0);
      html += '</optgroup>';
    }
    return html;
  },

  accountOptionsHtml(selectedId, { excludeId = null } = {}) {
    return this.accounts
      .filter(a => a.id !== excludeId)
      .map(a => `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${window.fmt.escapeHtml(a.name)}</option>`)
      .join('');
  },
};
