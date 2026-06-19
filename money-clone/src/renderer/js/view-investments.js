window.views = window.views || {};

window.views.investments = {
  async render(container) {
    const investmentAccounts = window.appState.accounts.filter(a => a.type === 'investment');

    if (investmentAccounts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">&#9650;</div>
          <h3>No investment accounts yet</h3>
          <p>Create an account with type "Investment" to start tracking holdings.</p>
          <button class="btn btn-primary" id="inv-new-account" style="margin-top:var(--space-3);">+ New Investment Account</button>
        </div>
      `;
      container.querySelector('#inv-new-account').addEventListener('click', () => {
        window.views.accounts.openForm();
      });
      return;
    }

    const summary = await window.ui.callApi(window.api.investments.getPortfolioSummary(null));
    const securities = await window.ui.callApi(window.api.investments.listSecurities());

    container.innerHTML = `
      <div class="toolbar">
        <select id="inv-account-select">
          <option value="">All Investment Accounts</option>
          ${investmentAccounts.map(a => `<option value="${a.id}">${window.fmt.escapeHtml(a.name)}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <button class="btn" id="inv-manage-securities">Manage Securities</button>
        <button class="btn btn-primary" id="inv-record-tx">+ Record Transaction</button>
      </div>

      <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="stat-card">
          <div class="stat-label">Portfolio Value</div>
          <div class="stat-value">${window.fmt.currency(summary.totalValue)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cost Basis</div>
          <div class="stat-value">${window.fmt.currency(summary.totalCost)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Gain / Loss</div>
          <div class="stat-value ${summary.totalGainLoss >= 0 ? 'positive' : 'negative'}">${window.fmt.signedCurrency(summary.totalGainLoss)}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>Holdings</h2></div>
        <div class="panel-body" style="padding:0;">
          ${summary.holdings.length === 0 ? `
            <div class="empty-state"><p>No holdings yet. Record a buy transaction to get started.</p></div>
          ` : `
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Symbol</th><th>Name</th><th style="text-align:right;">Shares</th>
                  <th style="text-align:right;">Price</th><th style="text-align:right;">Market Value</th>
                  <th style="text-align:right;">Cost Basis</th><th style="text-align:right;">Gain/Loss</th>
                </tr>
              </thead>
              <tbody>
                ${summary.holdings.map(h => `
                  <tr>
                    <td><strong>${window.fmt.escapeHtml(h.symbol)}</strong></td>
                    <td>${window.fmt.escapeHtml(h.name || '')}</td>
                    <td class="amount-cell">${h.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td class="amount-cell">${window.fmt.currency(h.current_price)}</td>
                    <td class="amount-cell">${window.fmt.currency(h.marketValue)}</td>
                    <td class="amount-cell">${window.fmt.currency(h.costBasis)}</td>
                    <td class="amount-cell ${h.gainLoss >= 0 ? 'positive' : 'negative'}">${window.fmt.signedCurrency(h.gainLoss)} (${h.gainLossPct >= 0 ? '+' : ''}${h.gainLossPct}%)</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;

    container.querySelector('#inv-account-select').addEventListener('change', async (e) => {
      const accountId = e.target.value ? Number(e.target.value) : null;
      const filtered = await window.ui.callApi(window.api.investments.getPortfolioSummary(accountId));
      this.renderHoldingsTable(container, filtered);
    });

    container.querySelector('#inv-record-tx').addEventListener('click', () => {
      this.openTransactionForm(investmentAccounts, securities);
    });
    container.querySelector('#inv-manage-securities').addEventListener('click', () => {
      this.openSecuritiesManager(securities);
    });
  },

  renderHoldingsTable(container, summary) {
    const statCards = container.querySelectorAll('.stat-value');
    if (statCards[0]) statCards[0].textContent = window.fmt.currency(summary.totalValue);
    if (statCards[1]) statCards[1].textContent = window.fmt.currency(summary.totalCost);
    if (statCards[2]) {
      statCards[2].textContent = window.fmt.signedCurrency(summary.totalGainLoss);
      statCards[2].className = `stat-value ${summary.totalGainLoss >= 0 ? 'positive' : 'negative'}`;
    }

    const panelBody = container.querySelectorAll('.panel-body')[1];
    if (!panelBody) return;
    panelBody.innerHTML = summary.holdings.length === 0 ? `
      <div class="empty-state"><p>No holdings for this account yet.</p></div>
    ` : `
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Symbol</th><th>Name</th><th style="text-align:right;">Shares</th>
            <th style="text-align:right;">Price</th><th style="text-align:right;">Market Value</th>
            <th style="text-align:right;">Cost Basis</th><th style="text-align:right;">Gain/Loss</th>
          </tr>
        </thead>
        <tbody>
          ${summary.holdings.map(h => `
            <tr>
              <td><strong>${window.fmt.escapeHtml(h.symbol)}</strong></td>
              <td>${window.fmt.escapeHtml(h.name || '')}</td>
              <td class="amount-cell">${h.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
              <td class="amount-cell">${window.fmt.currency(h.current_price)}</td>
              <td class="amount-cell">${window.fmt.currency(h.marketValue)}</td>
              <td class="amount-cell">${window.fmt.currency(h.costBasis)}</td>
              <td class="amount-cell ${h.gainLoss >= 0 ? 'positive' : 'negative'}">${window.fmt.signedCurrency(h.gainLoss)} (${h.gainLossPct >= 0 ? '+' : ''}${h.gainLossPct}%)</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  openSecuritiesManager(securities) {
    const modalEl = window.ui.openModal({
      title: 'Manage Securities',
      width: '600px',
      bodyHtml: `
        <div id="securities-list">
          ${securities.length === 0 ? '<p style="color:var(--color-text-secondary);">No securities added yet.</p>' : `
            <table class="ledger-table">
              <thead><tr><th>Symbol</th><th>Name</th><th>Type</th><th style="text-align:right;">Current Price</th></tr></thead>
              <tbody>
                ${securities.map(s => `
                  <tr>
                    <td><strong>${window.fmt.escapeHtml(s.symbol)}</strong></td>
                    <td>${window.fmt.escapeHtml(s.name || '')}</td>
                    <td>${s.type}</td>
                    <td><input type="number" step="0.01" class="security-price-input" data-id="${s.id}" value="${s.current_price}" style="width:90px; text-align:right; font-family:var(--font-mono); padding:var(--space-1) var(--space-2); border:1px solid var(--color-border-strong); border-radius:var(--radius-sm);" /></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
        <hr style="margin: var(--space-5) 0; border:none; border-top:1px solid var(--color-border);" />
        <h3 style="font-family:var(--font-display); font-size:var(--text-md); margin: 0 0 var(--space-3);">Add New Security</h3>
        <div class="form-grid">
          <div class="form-field"><label>Symbol</label><input type="text" id="new-sec-symbol" placeholder="e.g. AAPL" /></div>
          <div class="form-field"><label>Name</label><input type="text" id="new-sec-name" placeholder="e.g. Apple Inc." /></div>
          <div class="form-field">
            <label>Type</label>
            <select id="new-sec-type">
              <option value="stock">Stock</option><option value="etf">ETF</option>
              <option value="mutual_fund">Mutual Fund</option><option value="bond">Bond</option>
              <option value="crypto">Crypto</option><option value="other">Other</option>
            </select>
          </div>
          <div class="form-field"><label>Current Price</label><input type="number" step="0.01" id="new-sec-price" value="0" /></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn" id="sec-close">Close</button>
          <button type="button" class="btn btn-primary" id="sec-add">Add Security</button>
        </div>
      `,
    });

    modalEl.querySelectorAll('.security-price-input').forEach(input => {
      input.addEventListener('change', async () => {
        await window.ui.callApi(window.api.investments.updateSecurityPrice(Number(input.dataset.id), parseFloat(input.value) || 0));
        window.ui.showToast('Price updated.');
        await window.router.refreshCurrentView();
      });
    });

    modalEl.querySelector('#sec-close').addEventListener('click', window.ui.closeModal);
    modalEl.querySelector('#sec-add').addEventListener('click', async () => {
      const symbol = modalEl.querySelector('#new-sec-symbol').value.trim();
      if (!symbol) { window.ui.showToast('Symbol is required.', { type: 'error' }); return; }
      await window.ui.callApi(window.api.investments.upsertSecurity({
        symbol,
        name: modalEl.querySelector('#new-sec-name').value.trim(),
        type: modalEl.querySelector('#new-sec-type').value,
        current_price: parseFloat(modalEl.querySelector('#new-sec-price').value) || 0,
      }));
      window.ui.showToast('Security added.');
      window.ui.closeModal();
      await window.router.refreshCurrentView();
    });
  },

  openTransactionForm(investmentAccounts, securities) {
    const modalEl = window.ui.openModal({
      title: 'Record Investment Transaction',
      bodyHtml: `
        <form id="inv-tx-form">
          <div class="form-grid">
            <div class="form-field">
              <label for="inv-account">Account</label>
              <select id="inv-account">${investmentAccounts.map(a => `<option value="${a.id}">${window.fmt.escapeHtml(a.name)}</option>`).join('')}</select>
            </div>
            <div class="form-field">
              <label for="inv-security">Security</label>
              <select id="inv-security">
                ${securities.length === 0 ? '<option value="">No securities — add one first</option>' : securities.map(s => `<option value="${s.id}">${window.fmt.escapeHtml(s.symbol)} — ${window.fmt.escapeHtml(s.name || '')}</option>`).join('')}
              </select>
            </div>
            <div class="form-field">
              <label for="inv-action">Action</label>
              <select id="inv-action">
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="dividend">Dividend (cash)</option>
                <option value="reinvest">Reinvest Dividend</option>
              </select>
            </div>
            <div class="form-field">
              <label for="inv-date">Date</label>
              <input type="date" id="inv-date" required value="${window.fmt.todayIso()}" />
            </div>
            <div class="form-field" id="inv-shares-wrap">
              <label for="inv-shares">Shares</label>
              <input type="number" step="0.0001" id="inv-shares" value="0" />
            </div>
            <div class="form-field" id="inv-price-wrap">
              <label for="inv-price">Price per Share</label>
              <input type="number" step="0.01" id="inv-price" value="0" />
            </div>
            <div class="form-field">
              <label for="inv-commission">Commission</label>
              <input type="number" step="0.01" id="inv-commission" value="0" />
            </div>
            <div class="form-field full">
              <label for="inv-memo">Memo</label>
              <input type="text" id="inv-memo" />
            </div>
          </div>
          <div class="form-error" id="inv-tx-error" style="display:none;"></div>
          <div class="form-actions">
            <button type="button" class="btn" id="inv-tx-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Record Transaction</button>
          </div>
        </form>
      `,
    });

    const actionSelect = modalEl.querySelector('#inv-action');
    const sharesWrap = modalEl.querySelector('#inv-shares-wrap');
    const priceWrap = modalEl.querySelector('#inv-price-wrap');
    const priceLabel = priceWrap.querySelector('label');

    actionSelect.addEventListener('change', () => {
      if (actionSelect.value === 'dividend') {
        sharesWrap.style.display = 'none';
        priceLabel.textContent = 'Dividend Amount';
      } else {
        sharesWrap.style.display = '';
        priceLabel.textContent = 'Price per Share';
      }
    });

    modalEl.querySelector('#inv-tx-cancel').addEventListener('click', window.ui.closeModal);

    modalEl.querySelector('#inv-tx-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = modalEl.querySelector('#inv-tx-error');
      errorEl.style.display = 'none';

      const securityId = modalEl.querySelector('#inv-security').value;
      if (!securityId) {
        errorEl.textContent = 'Add a security first under "Manage Securities".';
        errorEl.style.display = 'block';
        return;
      }

      try {
        await window.ui.callApi(window.api.investments.recordTransaction({
          account_id: Number(modalEl.querySelector('#inv-account').value),
          security_id: Number(securityId),
          date: modalEl.querySelector('#inv-date').value,
          action: actionSelect.value,
          shares: parseFloat(modalEl.querySelector('#inv-shares').value) || 0,
          price: parseFloat(modalEl.querySelector('#inv-price').value) || 0,
          commission: parseFloat(modalEl.querySelector('#inv-commission').value) || 0,
          memo: modalEl.querySelector('#inv-memo').value.trim() || null,
        }));
        window.ui.showToast('Investment transaction recorded.');
        window.ui.closeModal();
        await window.router.refreshCurrentView();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      }
    });
  },
};
