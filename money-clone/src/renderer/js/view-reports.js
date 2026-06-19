window.views = window.views || {};

window.views.reports = {
  async render(container) {
    container.innerHTML = `
      <div class="tabs">
        <div class="tab active" data-tab="spending">Spending by Category</div>
        <div class="tab" data-tab="income-expense">Income vs. Expense</div>
        <div class="tab" data-tab="net-worth">Net Worth Trend</div>
      </div>
      <div id="report-content"></div>
    `;

    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderTab(container.querySelector('#report-content'), tab.dataset.tab);
      });
    });

    await this.renderTab(container.querySelector('#report-content'), 'spending');
  },

  getDateRange() {
    const today = window.fmt.todayIso();
    const year = today.slice(0, 4);
    return { startDate: `${year}-01-01`, endDate: today };
  },

  async renderTab(content, tab) {
    content.innerHTML = `<div class="empty-state"><p>Loading…</p></div>`;
    const { startDate, endDate } = this.getDateRange();

    if (tab === 'spending') {
      const data = await window.ui.callApi(window.api.reports.spendingByCategory({ startDate, endDate }));
      const total = data.reduce((s, r) => s + r.total, 0);

      content.innerHTML = `
        <div class="panel">
          <div class="panel-header"><h2>Spending by Category (Year to Date)</h2></div>
          <div class="panel-body">
            ${data.length === 0 ? '<div class="empty-state"><p>No expense data for this period.</p></div>' : `
              <div style="display:grid; grid-template-columns: 240px 1fr; gap: var(--space-6); align-items:center;">
                <div id="report-donut"></div>
                <table class="ledger-table">
                  <thead><tr><th>Category</th><th style="text-align:right;">Amount</th><th style="text-align:right;">% of Total</th></tr></thead>
                  <tbody>
                    ${data.map((row, i) => `
                      <tr>
                        <td><span class="legend-swatch" style="background:${window.fmt.CHART_COLORS[i % window.fmt.CHART_COLORS.length]}; display:inline-block; margin-right:8px;"></span>${window.fmt.escapeHtml(row.category_name)}</td>
                        <td class="amount-cell">${window.fmt.currency(row.total)}</td>
                        <td class="amount-cell">${total > 0 ? Math.round((row.total / total) * 100) : 0}%</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      `;
      if (data.length > 0) window.charts.renderDonut(content.querySelector('#report-donut'), data, total);
    }

    if (tab === 'income-expense') {
      const data = await window.ui.callApi(window.api.reports.incomeVsExpense({ startDate, endDate, groupBy: 'month' }));
      const chartData = data.map(d => ({ label: window.fmt.monthLabel(d.period).split(' ')[0], income: d.income, expense: d.expense }));
      const totalIncome = data.reduce((s, r) => s + r.income, 0);
      const totalExpense = data.reduce((s, r) => s + r.expense, 0);

      content.innerHTML = `
        <div class="stat-grid" style="grid-template-columns: repeat(3,1fr);">
          <div class="stat-card"><div class="stat-label">Total Income</div><div class="stat-value positive">${window.fmt.currency(totalIncome)}</div></div>
          <div class="stat-card"><div class="stat-label">Total Expense</div><div class="stat-value negative">${window.fmt.currency(totalExpense)}</div></div>
          <div class="stat-card"><div class="stat-label">Net</div><div class="stat-value ${totalIncome - totalExpense >= 0 ? 'positive' : 'negative'}">${window.fmt.signedCurrency(totalIncome - totalExpense)}</div></div>
        </div>
        <div class="panel">
          <div class="panel-header"><h2>Income vs. Expense by Month</h2></div>
          <div class="panel-body">
            ${chartData.length === 0 ? '<div class="empty-state"><p>No data for this period.</p></div>' : `
              <div id="report-bar"></div>
              <div class="legend">
                <div class="legend-item"><span class="legend-swatch" style="background:var(--color-accent);"></span>Income</div>
                <div class="legend-item"><span class="legend-swatch" style="background:var(--color-negative);"></span>Expense</div>
              </div>
            `}
          </div>
        </div>
      `;
      if (chartData.length > 0) {
        window.charts.renderBarChart(content.querySelector('#report-bar'), chartData, {
          keys: ['income', 'expense'],
          colors: ['var(--color-accent)', 'var(--color-negative)'],
        });
      }
    }

    if (tab === 'net-worth') {
      const yearStart = `${startDate.slice(0, 4)}-01-01`;
      const data = await window.ui.callApi(window.api.reports.netWorthOverTime({ startDate: yearStart, endDate }));
      const chartData = data.map(d => ({ label: window.fmt.monthLabel(d.month).split(' ')[0], netWorth: d.netWorth }));

      content.innerHTML = `
        <div class="panel">
          <div class="panel-header"><h2>Net Worth Over Time</h2></div>
          <div class="panel-body">
            ${chartData.length === 0 ? '<div class="empty-state"><p>No data available.</p></div>' : `<div id="report-line"></div>`}
          </div>
        </div>
      `;
      if (chartData.length > 0) {
        window.charts.renderLineChart(content.querySelector('#report-line'), chartData, { key: 'netWorth' });
      }
    }
  },
};
