const { getDb } = require('./db');

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function listAccounts({ includeClosed = false } = {}) {
  const db = getDb();
  const where = includeClosed ? '' : 'WHERE a.is_closed = 0';
  const rows = db.prepare(`
    SELECT a.*,
      COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.account_id = a.id), 0) AS transaction_total
    FROM accounts a
    ${where}
    ORDER BY a.sort_order ASC, a.id ASC
  `).all();

  return rows.map(r => ({ ...r, balance: round2(r.opening_balance + r.transaction_total) }));
}

function getAccount(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!row) return null;
  const totalRow = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE account_id = ?'
  ).get(id);
  return { ...row, balance: round2(row.opening_balance + totalRow.total) };
}

function createAccount(data) {
  const db = getDb();
  if (!data.name || !data.name.trim()) throw new Error('Account name is required');
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM accounts').get().m;
  const result = db.prepare(`
    INSERT INTO accounts (name, type, institution, account_number, opening_balance, currency, credit_limit, notes, sort_order)
    VALUES (@name, @type, @institution, @account_number, @opening_balance, @currency, @credit_limit, @notes, @sort_order)
  `).run({
    name: data.name.trim(),
    type: data.type,
    institution: data.institution || null,
    account_number: data.account_number || null,
    opening_balance: data.opening_balance || 0,
    currency: data.currency || 'USD',
    credit_limit: data.credit_limit ?? null,
    notes: data.notes || null,
    sort_order: maxOrder + 1,
  });
  return getAccount(result.lastInsertRowid);
}

function updateAccount(id, data) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!existing) throw new Error('Account not found');
  const merged = { ...existing, ...data };
  db.prepare(`
    UPDATE accounts SET
      name = @name, type = @type, institution = @institution,
      account_number = @account_number, opening_balance = @opening_balance,
      currency = @currency, credit_limit = @credit_limit, notes = @notes,
      is_closed = @is_closed, updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...merged, id });
  return getAccount(id);
}

function deleteAccount(id) {
  const db = getDb();
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  return true;
}

function getTotalNetWorth() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT a.type,
      a.opening_balance + COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.account_id = a.id), 0) AS balance
    FROM accounts a WHERE a.is_closed = 0
  `).all();

  let assets = 0;
  let liabilities = 0;
  for (const r of rows) {
    if (r.type === 'credit' || r.type === 'loan') {
      if (r.balance < 0) liabilities += Math.abs(r.balance);
      else assets += r.balance;
    } else {
      assets += r.balance;
    }
  }
  return { assets: round2(assets), liabilities: round2(liabilities), netWorth: round2(assets - liabilities) };
}

module.exports = { listAccounts, getAccount, createAccount, updateAccount, deleteAccount, getTotalNetWorth };
