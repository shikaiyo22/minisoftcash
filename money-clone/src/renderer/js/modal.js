// Toast notifications and a generic modal helper.

function ensureToastContainer() {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, { type = 'info', duration = 3200 } = {}) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' error' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s ease';
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

// Unwraps the { ok, data, error } envelope from IPC calls, showing a toast on failure.
async function callApi(promise, { errorMessage } = {}) {
  const result = await promise;
  if (!result || result.ok === false) {
    const msg = (result && result.error) || errorMessage || 'Something went wrong.';
    showToast(msg, { type: 'error', duration: 4500 });
    throw new Error(msg);
  }
  return result.data;
}

let activeModalOverlay = null;

function closeModal() {
  if (activeModalOverlay) {
    activeModalOverlay.remove();
    activeModalOverlay = null;
    document.removeEventListener('keydown', handleModalEscape);
  }
}

function handleModalEscape(e) {
  if (e.key === 'Escape') closeModal();
}

function openModal({ title, bodyHtml, onMount, width }) {
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="${width ? `width:${width};` : ''}">
      <div class="modal-header">
        <h2>${window.fmt.escapeHtml(title)}</h2>
        <button class="modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  `;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.querySelector('.modal-close').addEventListener('click', closeModal);

  document.body.appendChild(overlay);
  activeModalOverlay = overlay;
  document.addEventListener('keydown', handleModalEscape);

  const modalEl = overlay.querySelector('.modal');
  if (onMount) onMount(modalEl);

  return modalEl;
}

function confirmDialog({ title, message, confirmLabel = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    const modalEl = openModal({
      title,
      bodyHtml: `
        <p style="margin: 0 0 var(--space-5); color: var(--color-text-secondary);">${window.fmt.escapeHtml(message)}</p>
        <div class="form-actions">
          <button class="btn" id="confirm-cancel">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${window.fmt.escapeHtml(confirmLabel)}</button>
        </div>
      `,
    });
    modalEl.querySelector('#confirm-cancel').addEventListener('click', () => { closeModal(); resolve(false); });
    modalEl.querySelector('#confirm-ok').addEventListener('click', () => { closeModal(); resolve(true); });
  });
}

window.ui = { showToast, callApi, openModal, closeModal, confirmDialog };
