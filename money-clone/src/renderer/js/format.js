// Formatting utilities shared across views.

function formatCurrency(amount, currency = 'USD') {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedCurrency(amount, currency = 'USD') {
  const value = Number(amount) || 0;
  const formatted = formatCurrency(Math.abs(value), currency);
  return value < 0 ? `-${formatted}` : formatted;
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMonthLabel(yyyyMm) {
  if (!yyyyMm) return '';
  const [y, m] = yyyyMm.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function accountTypeLabel(type) {
  const labels = {
    checking: 'Checking', savings: 'Savings', credit: 'Credit Card',
    cash: 'Cash', investment: 'Investment', loan: 'Loan', asset: 'Asset',
  };
  return labels[type] || type;
}

const CHART_COLORS = [
  'var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)',
  'var(--color-chart-5)', 'var(--color-chart-6)', 'var(--color-chart-7)', 'var(--color-chart-8)',
];

window.fmt = {
  currency: formatCurrency,
  signedCurrency: formatSignedCurrency,
  date: formatDate,
  monthLabel: formatMonthLabel,
  todayIso,
  currentMonthStr,
  escapeHtml,
  accountTypeLabel,
  CHART_COLORS,
};
