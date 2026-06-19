window.views = window.views || {};

window.views.budget = {
  currentMonth: null,

  async render(container) {
    if (!this.currentMonth) this.currentMonth = window.fmt.currentMonthStr();
    if (window.appState.categories.length === 0) await window.appState.refreshCategories();

    await this.renderMonth(container);
  },

  async renderMonth(container) {
    const budgetRows = await window.ui.callApi(window.api.budgets.getForMonth(this.currentMonth));

    const tree = window.appState.categoriesTree.filter(c => c.type === 'expense');
    const rowsByCategory = new Map(budgetRows.map(r => [r.category_id, r]));

    const totalBudgeted = budgetRows.reduce((s, r) => s + r.budgeted, 0);
    const totalSpent = budgetRows.reduce((s, r) => s + r.spent, 0);

    container.innerHTML = `
      <div class="toolbar">
        <button class="btn btn-sm" id="budget-prev">&larr; Prev</button>
        <strong style="min-width:160px; text-align:center;">${window.fmt.monthLabel(this.currentMonth)}</strong>
        <button class="btn btn-sm" id="budget-next">Next &rarr;</button>
        <div class="spacer"></div>
        <button class="btn" id="budget-copy">Copy Previous Month</button>
      </div>

      <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="stat-card">
          <div class="stat-label">Total Budgeted</div>
          <div class="stat-value">${window.fmt.currency(totalBudgeted)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Spent</div>
          <div class="stat-value ${totalSpent > totalBudgeted ? 'negative' : ''}">${window.fmt.currency(totalSpent)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Remaining</div>
          <div class="stat-value ${totalBudgeted - totalSpent < 0 ? 'negative' : 'positive'}">${window.fmt.signedCurrency(totalBudgeted - totalSpent)}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>Category Budgets</h2></div>
        <div class="panel-body" style="padding:0;">
          <div class="budget-row parent" style="border-bottom:2px solid var(--color-border-strong);">
            <div>Category</div><div>Budgeted</div><div>Spent</div><div>Remaining</div><div>Progress</div>
          </div>
          <div id="budget-rows">
            ${tree.length === 0 ? `<div class="empty-state"><p>No expense categories found.</p></div>` : tree.map(parent => this.renderCategoryRow(parent, rowsByCategory, 0)).join('')}
          </div>
        </div>
      </div>
    `;

    container.querySelector('#budget-prev').addEventListener('click', () => this.shiftMonth(container, -1));
    container.querySelector('#budget-next').addEventListener('click', () => this.shiftMonth(container, 1));
    container.querySelector('#budget-copy').addEventListener('click', async () => {
      await window.ui.callApi(window.api.budgets.copyFromPreviousMonth(this.currentMonth));
      window.ui.showToast('Copied budget amounts from previous month.');
      await this.renderMonth(container);
    });

    container.querySelectorAll('.budget-input').forEach(input => {
      input.addEventListener('change', async () => {
        const categoryId = Number(input.dataset.categoryId);
        const amount = parseFloat(input.value) || 0;
        await window.ui.callApi(window.api.budgets.setAmount(categoryId, this.currentMonth, amount));
        window.ui.showToast('Budget updated.');
        await this.renderMonth(container);
      });
    });
  },

  renderCategoryRow(node, rowsByCategory, depth) {
    const data = rowsByCategory.get(node.id) || { budgeted: 0, spent: 0, remaining: 0 };
    const pct = data.budgeted > 0 ? Math.min(100, Math.round((data.spent / data.budgeted) * 100)) : (data.spent > 0 ? 100 : 0);
    const over = data.budgeted > 0 && data.spent > data.budgeted;

    let html = `
      <div class="budget-row" style="padding-left: calc(var(--space-3) + ${depth * 20}px);">
        <div>${window.fmt.escapeHtml(node.name)}</div>
        <div><input type="number" step="0.01" class="budget-input" data-category-id="${node.id}" value="${data.budgeted}" /></div>
        <div class="amount-cell ${data.spent > 0 ? 'negative' : ''}" style="text-align:left;">${window.fmt.currency(data.spent)}</div>
        <div class="amount-cell ${data.remaining < 0 ? 'negative' : 'positive'}" style="text-align:left;">${window.fmt.signedCurrency(data.remaining)}</div>
        <div class="budget-progress"><div class="budget-progress-bar ${over ? 'over' : ''}" style="width:${pct}%;"></div></div>
      </div>
    `;
    for (const child of node.children || []) {
      html += this.renderCategoryRow(child, rowsByCategory, depth + 1);
    }
    return html;
  },

  async shiftMonth(container, delta) {
    const [y, m] = this.currentMonth.split('-').map(Number);
    const newDate = new Date(y, m - 1 + delta, 1);
    this.currentMonth = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    await this.renderMonth(container);
  },
};
