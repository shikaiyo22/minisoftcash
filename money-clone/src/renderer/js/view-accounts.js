window.views = window.views || {};

window.views.accounts = {
  async render(container) {
    const accounts = await window.appState.refreshAccounts();

    const byType = {};
    for (const acc of accounts) {
      byType[acc.type] = byType[acc.type] || [];
      byType[acc.type].push(acc);
    }

    container.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary" id="acct-new">+ New Account</button>
      </div>
      ${accounts.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">&#9633;</div>
          <h3>No accounts yet</h3>
          <p>Add a checking, savings, credit card, or investment account to get started.</p>
          <button class="btn btn-primary" id="acct-new-empty" style="margin-top:var(--space-3);">+ New Account</button>
        </div>
      ` : Object.entries(byType).map(([type, accts]) => `
        <div class="panel">
          <div class="panel-header"><h2>${window.fmt.accountTypeLabel(type)}</h2></div>
          <div class="panel-body" style="padding:0;">
            <table class="ledger-table">
              <tbody>
                ${accts.map(a => `
                  <tr class="tx-row" data-account-id="${a.id}">
                    <td style="width:60%;">
                      <strong>${window.fmt.escapeHtml(a.name)}</strong>
                      ${a.institution ? `<div style="color:var(--color-text-muted); font-size:var(--text-xs);">${window.fmt.escapeHtml(a.institution)}</div>` : ''}
                    </td>
                    <td class="amount-cell ${a.balance < 0 ? 'negative' : 'positive'}" style="font-size:var(--text-md);">${window.fmt.signedCurrency(a.balance, a.currency)}</td>
                    <td style="width:40px;"><button class="btn btn-sm btn-icon acct-edit-btn" data-id="${a.id}" title="Edit">&#9998;</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}
    `;

    container.querySelectorAll('.tx-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.acct-edit-btn')) return;
        const id = Number(row.dataset.accountId);
        window.router.navigate('ledger', { accountId: id });
      });
    });

    container.querySelectorAll('.acct-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.views.accounts.openForm(Number(btn.dataset.id));
      });
    });

    container.querySelector('#acct-new')?.addEventListener('click', () => window.views.accounts.openForm());
    container.querySelector('#acct-new-empty')?.addEventListener('click', () => window.views.accounts.openForm());
  },

  openForm(accountId = null) {
    const existing = accountId ? window.appState.getAccount(accountId) : null;
    const isEdit = !!existing;

    const modalEl = window.ui.openModal({
      title: isEdit ? 'Edit Account' : 'New Account',
      bodyHtml: `
        <form id="account-form">
          <div class="form-grid">
            <div class="form-field full">
              <label for="f-name">Account Name</label>
              <input type="text" id="f-name" required value="${window.fmt.escapeHtml(existing?.name || '')}" placeholder="e.g. Chase Checking" />
            </div>
            <div class="form-field">
              <label for="f-type">Type</label>
              <select id="f-type">
                ${['checking', 'savings', 'credit', 'cash', 'investment', 'loan', 'asset'].map(t => `
                  <option value="${t}" ${existing?.type === t ? 'selected' : ''}>${window.fmt.accountTypeLabel(t)}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-field">
              <label for="f-institution">Institution</label>
              <input type="text" id="f-institution" value="${window.fmt.escapeHtml(existing?.institution || '')}" placeholder="e.g. Chase Bank" />
            </div>
            <div class="form-field">
              <label for="f-opening">${isEdit ? 'Opening Balance' : 'Starting Balance'}</label>
              <input type="number" step="0.01" id="f-opening" value="${existing?.opening_balance ?? 0}" />
            </div>
            <div class="form-field">
              <label for="f-credit-limit">Credit Limit (optional)</label>
              <input type="number" step="0.01" id="f-credit-limit" value="${existing?.credit_limit ?? ''}" />
            </div>
            <div class="form-field full">
              <label for="f-notes">Notes</label>
              <textarea id="f-notes">${window.fmt.escapeHtml(existing?.notes || '')}</textarea>
            </div>
          </div>
          <div class="form-error" id="account-form-error" style="display:none;"></div>
          <div class="form-actions">
            ${isEdit ? `<button type="button" class="btn btn-danger" id="account-delete" style="margin-right:auto;">Delete Account</button>` : ''}
            <button type="button" class="btn" id="account-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Account'}</button>
          </div>
        </form>
      `,
    });

    modalEl.querySelector('#account-cancel').addEventListener('click', window.ui.closeModal);

    if (isEdit) {
      modalEl.querySelector('#account-delete').addEventListener('click', async () => {
        const confirmed = await window.ui.confirmDialog({
          title: 'Delete Account',
          message: `Delete "${existing.name}" and all of its transactions? This cannot be undone.`,
        });
        if (!confirmed) return;
        await window.ui.callApi(window.api.accounts.delete(accountId));
        window.ui.closeModal();
        window.ui.showToast('Account deleted.');
        await window.router.refreshCurrentView();
      });
    }

    modalEl.querySelector('#account-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = modalEl.querySelector('#account-form-error');
      errorEl.style.display = 'none';

      const data = {
        name: modalEl.querySelector('#f-name').value.trim(),
        type: modalEl.querySelector('#f-type').value,
        institution: modalEl.querySelector('#f-institution').value.trim() || null,
        opening_balance: parseFloat(modalEl.querySelector('#f-opening').value) || 0,
        credit_limit: modalEl.querySelector('#f-credit-limit').value ? parseFloat(modalEl.querySelector('#f-credit-limit').value) : null,
        notes: modalEl.querySelector('#f-notes').value.trim() || null,
      };

      if (!data.name) {
        errorEl.textContent = 'Account name is required.';
        errorEl.style.display = 'block';
        return;
      }

      try {
        if (isEdit) {
          await window.ui.callApi(window.api.accounts.update(accountId, data));
          window.ui.showToast('Account updated.');
        } else {
          await window.ui.callApi(window.api.accounts.create(data));
          window.ui.showToast('Account created.');
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
