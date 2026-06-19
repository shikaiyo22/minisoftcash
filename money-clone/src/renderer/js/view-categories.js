window.views = window.views || {};

window.views.categories = {
  async render(container) {
    await window.appState.refreshCategories();

    const incomeRoots = window.appState.categoriesTree.filter(c => c.type === 'income');
    const expenseRoots = window.appState.categoriesTree.filter(c => c.type === 'expense');

    container.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary" id="cat-new">+ New Category</button>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-5);">
        <div class="panel">
          <div class="panel-header"><h2>Income Categories</h2></div>
          <div class="panel-body" style="padding:0;">
            ${this.renderList(incomeRoots)}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h2>Expense Categories</h2></div>
          <div class="panel-body" style="padding:0;">
            ${this.renderList(expenseRoots)}
          </div>
        </div>
      </div>
    `;

    container.querySelector('#cat-new').addEventListener('click', () => this.openForm());
    this.bindRowClicks(container);
  },

  renderList(roots) {
    if (roots.length === 0) return `<div class="empty-state"><p>No categories yet.</p></div>`;
    const renderNode = (node, depth) => {
      let html = `
        <div class="account-list-item" style="color:var(--color-text-primary); padding-left: calc(var(--space-5) + ${depth * 18}px); cursor:default;">
          <span class="acct-name">${window.fmt.escapeHtml(node.name)}</span>
          <span style="display:flex; gap:4px;">
            <button class="btn btn-sm btn-icon cat-edit" data-id="${node.id}" data-name="${window.fmt.escapeHtml(node.name)}" data-type="${node.type}" data-parent="${node.parent_id || ''}" title="Edit">&#9998;</button>
            ${!node.is_system ? `<button class="btn btn-sm btn-icon cat-delete" data-id="${node.id}" title="Delete">&times;</button>` : ''}
          </span>
        </div>
      `;
      for (const child of node.children || []) html += renderNode(child, depth + 1);
      return html;
    };
    return roots.map(r => renderNode(r, 0)).join('');
  },

  bindRowClicks(container) {
    container.querySelectorAll('.cat-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openForm({
          id: Number(btn.dataset.id),
          name: btn.dataset.name,
          type: btn.dataset.type,
          parent_id: btn.dataset.parent ? Number(btn.dataset.parent) : null,
        });
      });
    });
    container.querySelectorAll('.cat-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await window.ui.confirmDialog({
          title: 'Delete Category',
          message: 'Delete this category? Categories with existing transactions or subcategories cannot be deleted.',
        });
        if (!confirmed) return;
        try {
          await window.ui.callApi(window.api.categories.delete(Number(btn.dataset.id)));
          window.ui.showToast('Category deleted.');
          await window.router.refreshCurrentView();
        } catch (err) {
          // callApi already surfaces a toast on failure
        }
      });
    });
  },

  openForm(existing = null) {
    const isEdit = !!existing;
    const modalEl = window.ui.openModal({
      title: isEdit ? 'Edit Category' : 'New Category',
      bodyHtml: `
        <form id="cat-form">
          <div class="form-grid">
            <div class="form-field full">
              <label for="cat-name">Name</label>
              <input type="text" id="cat-name" required value="${window.fmt.escapeHtml(existing?.name || '')}" />
            </div>
            <div class="form-field">
              <label for="cat-type">Type</label>
              <select id="cat-type" ${isEdit ? 'disabled' : ''}>
                <option value="expense" ${(!existing || existing.type === 'expense') ? 'selected' : ''}>Expense</option>
                <option value="income" ${existing?.type === 'income' ? 'selected' : ''}>Income</option>
              </select>
            </div>
            <div class="form-field">
              <label for="cat-parent">Parent Category (optional)</label>
              <select id="cat-parent"><option value="">None (top level)</option></select>
            </div>
          </div>
          <div class="form-error" id="cat-form-error" style="display:none;"></div>
          <div class="form-actions">
            <button type="button" class="btn" id="cat-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Category'}</button>
          </div>
        </form>
      `,
    });

    const populateParents = (type) => {
      const parentSelect = modalEl.querySelector('#cat-parent');
      const roots = window.appState.categoriesTree.filter(c => c.type === type && c.id !== existing?.id);
      parentSelect.innerHTML = '<option value="">None (top level)</option>' +
        roots.map(r => `<option value="${r.id}" ${existing?.parent_id === r.id ? 'selected' : ''}>${window.fmt.escapeHtml(r.name)}</option>`).join('');
    };
    populateParents(existing?.type || 'expense');
    modalEl.querySelector('#cat-type').addEventListener('change', (e) => populateParents(e.target.value));

    modalEl.querySelector('#cat-cancel').addEventListener('click', window.ui.closeModal);

    modalEl.querySelector('#cat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = modalEl.querySelector('#cat-form-error');
      errorEl.style.display = 'none';

      const name = modalEl.querySelector('#cat-name').value.trim();
      if (!name) {
        errorEl.textContent = 'Category name is required.';
        errorEl.style.display = 'block';
        return;
      }
      const parentId = modalEl.querySelector('#cat-parent').value || null;

      try {
        if (isEdit) {
          await window.ui.callApi(window.api.categories.update(existing.id, { name, parent_id: parentId }));
          window.ui.showToast('Category updated.');
        } else {
          await window.ui.callApi(window.api.categories.create({
            name, type: modalEl.querySelector('#cat-type').value, parent_id: parentId,
          }));
          window.ui.showToast('Category created.');
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
