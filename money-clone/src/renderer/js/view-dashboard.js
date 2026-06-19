window.views = window.views || {};

window.views.dashboard = {
  async render(container) {
    container.innerHTML = `<div class="empty-state"><p>Loading dashboard…</p></div>`;

    const [netWorth, accounts] = await Promise.all([
      window.ui.callApi(window.api.accounts.netWorth()),
      window.appState.refreshAccounts(),
    ]);

    const today = window.fmt.todayIso();
    const startOfYear = `${today.slice(0, 4)}-01-01`;
    const spendingData = await window.ui.callApi(
      window.api.reports.spendingByCategory({ startDate: startOfYear, endDate: today })
    );

    const recentTx = await window.ui.callApi(
      window.api.transactions.list({ limit: 8, offset: 0 })
    );

    const topSpending = spendingData.slice(0, 6);
    const totalSpending = spendingData.reduce((s, r) => s + r.total, 0);

    container.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Net Worth</div>
          <div class="stat-value ${netWorth.netWorth >= 0 ? 'positive' : 'negative'}">${window.fmt.signedCurrency(netWorth.netWorth)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Assets</div>
          <div class="stat-value positive">${window.fmt.currency(netWorth.assets)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Liabilities</div>
          <div class="stat-value ${netWorth.liabilities > 0 ? 'negative' : ''}">${window.fmt.currency(netWorth.liabilities)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Accounts</div>
          <div class="stat-value">${accounts.length}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1.1fr 1fr; gap: var(--space-5); align-items: start;">
        <div class="panel">
          <div class="panel-header">
            <h2>Recent Transactions</h2>
            <button class="btn btn-sm" id="dash-view-all">View All</button>
          </div>
          <div class="panel-body" style="padding:0;">
            ${recentTx.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">&#9679;</div>
                <h3>No transactions yet</h3>
                <p>Add an account and start recording transactions to see activity here.</p>
              </div>
            ` : `
              <table class="ledger-table">
                <thead><tr><th>Date</th><th>Payee</th><th>Account</th><th>Category</th><th style="text-align:right;">Amount</th></tr></thead>
                <tbody>
                  ${recentTx.map(tx => `
                    <tr>
                      <td>${window.fmt.date(tx.date)}</td>
                      <td>${window.fmt.escapeHtml(tx.payee_name || '—')}</td>
                      <td>${window.fmt.escapeHtml(tx.account_name || '')}</td>
                      <td>${window.fmt.escapeHtml(tx.category_name || (tx.is_split_parent ? 'Split' : '—'))}</td>
                      <td class="amount-cell ${tx.amount < 0 ? 'negative' : 'positive'}">${window.fmt.signedCurrency(tx.amount)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h2>Spending This Year</h2></div>
          <div class="panel-body">
            ${topSpending.length === 0 ? `
              <div class="empty-state">
                <p>No expense transactions recorded yet this year.</p>
              </div>
            ` : `
              <div id="dash-spending-chart"></div>
              <div class="legend">
                ${topSpending.map((row, i) => `
                  <div class="legend-item">
                    <span class="legend-swatch" style="background:${window.fmt.CHART_COLORS[i % window.fmt.CHART_COLORS.length]}"></span>
                    ${window.fmt.escapeHtml(row.category_name)} — ${window.fmt.currency(row.total)}
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    container.querySelector('#dash-view-all')?.addEventListener('click', () => {
      window.router.navigate('accounts');
    });

    if (topSpending.length > 0) {
      window.charts.renderDonut(container.querySelector('#dash-spending-chart'), topSpending, totalSpending);
    }
  },
};
