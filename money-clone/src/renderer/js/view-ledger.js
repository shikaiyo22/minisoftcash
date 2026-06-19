window.views = window.views || {};

window.views.ledger = {
  async render(container, params) {
    const accountId = params?.accountId || window.appState.currentAccountId;
    if (!accountId) {
      container.innerHTML = `<div class="empty-state"><h3>No account selected</h3><p>Choose an account from the sidebar.</p></div>`;
      return;
    }
    window.appState.currentAccountId = accountId;

    await window.appState.refreshAccounts();
    const account = window.appState.getAccount(accountId);
    if (!account) {
      container.innerHTML = `<div class="empty-state"><h3>Account not found</h3></div>`;
      return;
    }

    if (window.appState.categories.length === 0) await window.appState.refreshCategories();
    if (window.appState.payees.length === 0) await window.appState.refreshPayees();

    const txList = await window.ui.callApi(window.api.transactions.listWithBalance(accountId));

    container.innerHTML = `
      <div class="toolbar">
        <input type="search" id="ledger-search" placeholder="Search payee or memo…" style="width:240px;" />
        <div class="spacer"></div>
        <button class="btn" id="ledger-new-transfer">Transfer</button>
        <button class="btn btn-primary" id="ledger-new-tx">+ New Transaction</button>
      </div>

      <div class="panel">
        <div class="panel-body" style="padding:0; max-height: calc(100vh - 260px); overflow-y: auto;">
          <table class="ledger-table" id="ledger-table">
            <thead>
              <tr>
                <th style="width:90px;">Date</th>
                <th>Payee</th>
                <th>Category</th>
                <th>Memo</th>
                <th style="width:24px;"></th>
                <th style="width:110px; text-align:right;">Amount</th>
                <th style="width:110px; text-align:right;">Balance</th>
              </tr>
            </thead>
            <tbody id="ledger-tbody">
              ${txList.length === 0 ? `
                <tr><td colspan="7">
                  <div class="empty-state">
                    <div class="empty-icon">&#9776;</div>
                    <h3>No transactions yet</h3>
                    <p>Record your first transaction in ${window.fmt.escapeHtml(account.name)}.</p>
                  </div>
                </td></tr>
              ` : this.renderRows(txList)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindRowClicks(container, accountId, txList);

    container.querySelector('#ledger-new-tx').addEventListener('click', () => {
      window.views.ledger.openTransactionForm(accountId);
    });
    container.querySelector('#ledger-new-transfer').addEventListener('click', () => {
      window.views.ledger.openTransferForm(accountId);
    });

    const searchInput = container.querySelector('#ledger-search');
    let searchTimer = null;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        const query = searchInput.value.trim();
        const filtered = query
          ? await window.ui.callApi(window.api.transactions.list({ accountId, search: query }))
          : txList;
        const tbody = container.querySelector('#ledger-tbody');
        if (tbody) {
          const rowsToShow = query ? filtered.map(t => ({ ...t, running_balance: undefined })) : filtered;
          tbody.innerHTML = rowsToShow.length === 0
            ? `<tr><td colspan="7"><div class="empty-state"><p>No transactions match "${window.fmt.escapeHtml(query)}".</p></div></td></tr>`
            : this.renderRows(rowsToShow);
          this.bindRowClicks(container, accountId, query ? filtered : txList);
        }
      }, 200);
    });
  },

  renderRows(txList) {
    return txList.map(tx => `
      <tr class="tx-row" data-tx-id="${tx.id}">
        <td>${window.fmt.date(tx.date)}</td>
        <td>
          <span class="status-dot ${tx.status}" title="${tx.status}"></span>${window.fmt.escapeHtml(tx.payee_name || (tx.transfer_group_id ? 'Transfer' : '—'))}
        </td>
        <td>${window.fmt.escapeHtml(tx.category_name || '—')}${tx.is_split_parent ? '<span class="split-badge">Split</span>' : ''}</td>
        <td style="color:var(--color-text-secondary);">${window.fmt.escapeHtml(tx.memo || '')}</td>
        <td></td>
        <td class="amount-cell ${tx.amount < 0 ? 'negative' : 'positive'}">${window.fmt.signedCurrency(tx.amount)}</td>
        <td class="balance-cell">${tx.running_balance !== undefined ? window.fmt.signedCurrency(tx.running_balance) : ''}</td>
      </tr>
    `).join('');
  },

  bindRowClicks(container, accountId, txList) {
    container.querySelectorAll('.tx-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = Number(row.dataset.txId);
        const tx = txList.find(t => t.id === id);
        if (tx?.transfer_group_id) {
          window.views.ledger.openTransferForm(accountId, tx);
        } else {
          window.views.ledger.openTransactionForm(accountId, tx);
        }
      });
    });
  },

  openTransactionForm(accountId, existing = null) {
    const isEdit = !!existing;
    const hasSplits = isEdit && existing.is_split_parent && existing.splits?.length;
    const initialAmount = existing ? Math.abs(existing.amount) : '';
    const initialSign = existing && existing.amount < 0 ? 'expense' : (existing ? 'income' : 'expense');

    const modalEl = window.ui.openModal({
      title: isEdit ? 'Edit Transaction' : 'New Transaction',
      width: '620px',
      bodyHtml: `
        <form id="tx-form">
          <div class="form-grid">
            <div class="form-field">
              <label for="tx-date">Date</label>
              <input type="date" id="tx-date" required value="${existing?.date || window.fmt.todayIso()}" />
            </div>
            <div class="form-field">
              <label for="tx-type">Type</label>
              <select id="tx-type">
                <option value="expense" ${initialSign === 'expense' ? 'selected' : ''}>Expense (money out)</option>
                <option value="income" ${initialSign === 'income' ? 'selected' : ''}>Income (money in)</option>
              </select>
            </div>
            <div class="form-field full">
              <label for="tx-payee">Payee</label>
              <input type="text" id="tx-payee" list="payee-list" value="${window.fmt.escapeHtml(existing?.payee_name || '')}" placeholder="e.g. Whole Foods" />
              <datalist id="payee-list">
                ${window.appState.payees.map(p => `<option value="${window.fmt.escapeHtml(p.name)}"></option>`).join('')}
              </datalist>
            </div>
            <div class="form-field">
              <label for="tx-amount">Amount</label>
              <input type="number" step="0.01" min="0" id="tx-amount" required value="${initialAmount}" />
            </div>
            <div class="form-field">
              <label for="tx-status">Status</label>
              <select id="tx-status">
                <option value="unreconciled" ${existing?.status === 'unreconciled' ? 'selected' : ''}>Unreconciled</option>
                <option value="cleared" ${existing?.status === 'cleared' ? 'selected' : ''}>Cleared</option>
                <option value="reconciled" ${existing?.status === 'reconciled' ? 'selected' : ''}>Reconciled</option>
              </select>
            </div>
            <div class="form-field full" id="tx-category-wrap" style="${hasSplits ? 'display:none;' : ''}">
              <label for="tx-category">Category</label>
              <select id="tx-category">${window.appState.categoryOptionsHtml(existing?.category_id)}</select>
            </div>
            <div class="form-field full">
              <label for="tx-memo">Memo</label>
              <input type="text" id="tx-memo" value="${window.fmt.escapeHtml(existing?.memo || '')}" />
            </div>
          </div>

          <div style="margin-top:var(--space-3);">
            <button type="button" class="btn btn-sm" id="tx-toggle-splits">${hasSplits ? 'Remove Splits' : 'Split Transaction'}</button>
          </div>

          <div id="tx-splits-section" style="display:${hasSplits ? 'block' : 'none'}; margin-top:var(--space-4);">
            <label style="font-size:var(--text-xs); font-weight:600; color:var(--color-text-secondary); text-transform:uppercase;">Splits</label>
            <div id="tx-splits-rows" style="margin-top:var(--space-2);"></div>
            <button type="button" class="btn btn-sm" id="tx-add-split">+ Add Split</button>
            <div class="split-remainder" id="tx-split-remainder"></div>
          </div>

          <div class="form-error" id="tx-form-error" style="display:none;"></div>
          <div class="form-actions">
            ${isEdit ? `<button type="button" class="btn btn-danger" id="tx-delete" style="margin-right:auto;">Delete</button>` : ''}
            <button type="button" class="btn" id="tx-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Transaction'}</button>
          </div>
        </form>
      `,
    });

    const splitsRows = modalEl.querySelector('#tx-splits-rows');
    const addSplitRow = (split = { category_id: '', amount: '', memo: '' }) => {
      const row = document.createElement('div');
      row.className = 'split-row';
      row.innerHTML = `
        <select class="split-category">${window.appState.categoryOptionsHtml(split.category_id, { includeBlank: true })}</select>
        <input type="number" step="0.01" class="split-amount" placeholder="Amount" value="${split.amount !== '' ? Math.abs(split.amount) : ''}" />
        <input type="text" class="split-memo" placeholder="Memo" value="${window.fmt.escapeHtml(split.memo || '')}" />
        <button type="button" class="split-remove" title="Remove">&times;</button>
      `;
      row.querySelector('.split-remove').addEventListener('click', () => { row.remove(); updateRemainder(); });
      row.querySelector('.split-amount').addEventListener('input', updateRemainder);
      splitsRows.appendChild(row);
    };

    const updateRemainder = () => {
      const total = parseFloat(modalEl.querySelector('#tx-amount').value) || 0;
      const splitRows = [...splitsRows.querySelectorAll('.split-row')];
      const splitTotal = splitRows.reduce((sum, r) => sum + (parseFloat(r.querySelector('.split-amount').value) || 0), 0);
      const remainder = Math.round((total - splitTotal) * 100) / 100;
      const remainderEl = modalEl.querySelector('#tx-split-remainder');
      if (remainderEl) {
        remainderEl.textContent = remainder === 0 ? 'Splits balanced ✓' : `Remaining to assign: ${window.fmt.currency(remainder)}`;
        remainderEl.className = `split-remainder ${remainder === 0 ? 'balanced' : 'unbalanced'}`;
      }
    };

    if (hasSplits) {
      for (const s of existing.splits) addSplitRow(s);
      updateRemainder();
    }

    modalEl.querySelector('#tx-add-split').addEventListener('click', () => { addSplitRow(); updateRemainder(); });
    modalEl.querySelector('#tx-amount').addEventListener('input', updateRemainder);

    modalEl.querySelector('#tx-toggle-splits').addEventListener('click', () => {
      const section = modalEl.querySelector('#tx-splits-section');
      const categoryWrap = modalEl.querySelector('#tx-category-wrap');
      const isShowing = section.style.display !== 'none';
      if (isShowing) {
        section.style.display = 'none';
        categoryWrap.style.display = '';
        splitsRows.innerHTML = '';
        modalEl.querySelector('#tx-toggle-splits').textContent = 'Split Transaction';
      } else {
        section.style.display = 'block';
        categoryWrap.style.display = 'none';
        if (!splitsRows.children.length) { addSplitRow(); addSplitRow(); }
        updateRemainder();
        modalEl.querySelector('#tx-toggle-splits').textContent = 'Remove Splits';
      }
    });

    modalEl.querySelector('#tx-cancel').addEventListener('click', window.ui.closeModal);

    if (isEdit) {
      modalEl.querySelector('#tx-delete').addEventListener('click', async () => {
        const confirmed = await window.ui.confirmDialog({
          title: 'Delete Transaction',
          message: 'This transaction will be permanently deleted.',
        });
        if (!confirmed) return;
        await window.ui.callApi(window.api.transactions.delete(existing.id));
        window.ui.closeModal();
        window.ui.showToast('Transaction deleted.');
        await window.router.refreshCurrentView();
      });
    }

    modalEl.querySelector('#tx-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = modalEl.querySelector('#tx-form-error');
      errorEl.style.display = 'none';

      const type = modalEl.querySelector('#tx-type').value;
      const rawAmount = parseFloat(modalEl.querySelector('#tx-amount').value);
      if (isNaN(rawAmount) || rawAmount <= 0) {
        errorEl.textContent = 'Enter a valid amount greater than zero.';
        errorEl.style.display = 'block';
        return;
      }
      const signedAmount = type === 'expense' ? -Math.abs(rawAmount) : Math.abs(rawAmount);

      const splitsVisible = modalEl.querySelector('#tx-splits-section').style.display !== 'none';
      let splits = null;
      if (splitsVisible) {
        const rows = [...splitsRows.querySelectorAll('.split-row')];
        splits = rows.map(r => {
          const amt = parseFloat(r.querySelector('.split-amount').value) || 0;
          return {
            category_id: r.querySelector('.split-category').value || null,
            amount: type === 'expense' ? -Math.abs(amt) : Math.abs(amt),
            memo: r.querySelector('.split-memo').value.trim() || null,
          };
        }).filter(s => s.amount !== 0);

        const splitTotal = splits.reduce((s, sp) => s + sp.amount, 0);
        if (Math.abs(Math.round((splitTotal - signedAmount) * 100) / 100) > 0.005) {
          errorEl.textContent = 'Split amounts must add up to the total transaction amount.';
          errorEl.style.display = 'block';
          return;
        }
      }

      const data = {
        account_id: accountId,
        date: modalEl.querySelector('#tx-date').value,
        payee_name: modalEl.querySelector('#tx-payee').value.trim(),
        category_id: splitsVisible ? null : (modalEl.querySelector('#tx-category').value || null),
        amount: signedAmount,
        memo: modalEl.querySelector('#tx-memo').value.trim() || null,
        status: modalEl.querySelector('#tx-status').value,
        splits: splitsVisible ? splits : [],
      };

      try {
        if (isEdit) {
          await window.ui.callApi(window.api.transactions.update(existing.id, data));
          window.ui.showToast('Transaction updated.');
        } else {
          await window.ui.callApi(window.api.transactions.create(data));
          window.ui.showToast('Transaction added.');
        }
        window.ui.closeModal();
        await window.router.refreshCurrentView();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      }
    });
  },

  openTransferForm(accountId, existing = null) {
    const isEdit = !!existing;
    // When editing, 'existing' is only the leg currently shown in this account's ledger.
    // The backend only keeps date/amount/memo in sync across both legs (see transactions:update),
    // so account reassignment isn't supported here — show the accounts as read-only context instead.
    const thisAccount = window.appState.getAccount(accountId);

    const modalEl = window.ui.openModal({
      title: isEdit ? 'Edit Transfer' : 'Transfer Between Accounts',
      bodyHtml: `
        <form id="transfer-form">
          ${isEdit ? `
            <p style="margin:0 0 var(--space-4); padding: var(--space-3); background: var(--color-info-light); border-radius: var(--radius-md); font-size: var(--text-sm); color: var(--color-text-secondary);">
              This is one leg of a transfer ${existing.amount < 0 ? 'from' : 'to'} <strong>${window.fmt.escapeHtml(thisAccount?.name || '')}</strong>.
              Date, amount, and memo changes apply to both sides. To change which accounts are involved, delete and recreate the transfer.
            </p>
          ` : ''}
          <div class="form-grid">
            ${!isEdit ? `
              <div class="form-field">
                <label for="tr-from">From Account</label>
                <select id="tr-from">${window.appState.accountOptionsHtml(accountId)}</select>
              </div>
              <div class="form-field">
                <label for="tr-to">To Account</label>
                <select id="tr-to">${window.appState.accountOptionsHtml(null, { excludeId: accountId })}</select>
              </div>
            ` : ''}
            <div class="form-field">
              <label for="tr-date">Date</label>
              <input type="date" id="tr-date" required value="${existing?.date || window.fmt.todayIso()}" />
            </div>
            <div class="form-field">
              <label for="tr-amount">Amount</label>
              <input type="number" step="0.01" min="0.01" id="tr-amount" required value="${existing ? Math.abs(existing.amount) : ''}" />
            </div>
            <div class="form-field full">
              <label for="tr-memo">Memo</label>
              <input type="text" id="tr-memo" value="${window.fmt.escapeHtml(existing?.memo || '')}" />
            </div>
          </div>
          <div class="form-error" id="transfer-form-error" style="display:none;"></div>
          <div class="form-actions">
            ${isEdit ? `<button type="button" class="btn btn-danger" id="transfer-delete" style="margin-right:auto;">Delete Transfer</button>` : ''}
            <button type="button" class="btn" id="transfer-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Transfer'}</button>
          </div>
        </form>
      `,
    });

    if (!isEdit) {
      modalEl.querySelector('#tr-from').addEventListener('change', () => {
        const fromVal = Number(modalEl.querySelector('#tr-from').value);
        const toSelect = modalEl.querySelector('#tr-to');
        const currentTo = Number(toSelect.value);
        toSelect.innerHTML = window.appState.accountOptionsHtml(currentTo === fromVal ? null : currentTo, { excludeId: fromVal });
      });
    }

    modalEl.querySelector('#transfer-cancel').addEventListener('click', window.ui.closeModal);

    if (isEdit) {
      modalEl.querySelector('#transfer-delete').addEventListener('click', async () => {
        const confirmed = await window.ui.confirmDialog({
          title: 'Delete Transfer',
          message: 'Both sides of this transfer will be permanently deleted.',
        });
        if (!confirmed) return;
        await window.ui.callApi(window.api.transactions.delete(existing.id));
        window.ui.closeModal();
        window.ui.showToast('Transfer deleted.');
        await window.router.refreshCurrentView();
      });
    }

    modalEl.querySelector('#transfer-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = modalEl.querySelector('#transfer-form-error');
      errorEl.style.display = 'none';

      const amount = parseFloat(modalEl.querySelector('#tr-amount').value);
      if (isNaN(amount) || amount <= 0) {
        errorEl.textContent = 'Enter a valid amount greater than zero.';
        errorEl.style.display = 'block';
        return;
      }

      try {
        if (isEdit) {
          // Editing a transfer leg updates both sides via the transactions:update sync logic.
          const newAmount = existing.amount < 0 ? -Math.abs(amount) : Math.abs(amount);
          await window.ui.callApi(window.api.transactions.update(existing.id, {
            date: modalEl.querySelector('#tr-date').value,
            amount: newAmount,
            memo: modalEl.querySelector('#tr-memo').value.trim() || null,
          }));
          window.ui.showToast('Transfer updated.');
        } else {
          const fromAccountId = Number(modalEl.querySelector('#tr-from').value);
          const toAccountId = Number(modalEl.querySelector('#tr-to').value);
          if (fromAccountId === toAccountId) {
            errorEl.textContent = 'From and To accounts must be different.';
            errorEl.style.display = 'block';
            return;
          }
          await window.ui.callApi(window.api.transactions.createTransfer({
            fromAccountId, toAccountId,
            date: modalEl.querySelector('#tr-date').value,
            amount,
            memo: modalEl.querySelector('#tr-memo').value.trim() || null,
          }));
          window.ui.showToast('Transfer created.');
        }
        window.ui.closeModal();
        await window.router.refreshCurrentView();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
      }
    });
  },
};
