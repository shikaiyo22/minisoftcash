const { getDb } = require('./db');

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getSpendingByCategory({ startDate, endDate }) {
  const db = getDb();

  const direct = db.prepare(`
    SELECT c.id AS category_id, c.name AS category_name, SUM(t.amount) AS total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.is_split_parent = 0 AND c.type = 'expense' AND t.date >= ? AND t.date <= ?
    GROUP BY c.id
  `).all(startDate, endDate);

  const split = db.prepare(`
    SELECT c.id AS category_id, c.name AS category_name, SUM(s.amount) AS total
    FROM transaction_splits s
    JOIN transactions t ON t.id = s.transaction_id
    JOIN categories c ON c.id = s.category_id
    WHERE c.type = 'expense' AND t.date >= ? AND t.date <= ?
    GROUP BY c.id
  `).all(startDate, endDate);

  const combined = new Map();
  for (const row of [...direct, ...split]) {
    const prev = combined.get(row.category_id) || { category_id: row.category_id, category_name: row.category_name, total: 0 };
    prev.total += row.total;
    combined.set(row.category_id, prev);
  }

  return Array.from(combined.values())
    .map(r => ({ ...r, total: round2(Math.abs(r.total)) }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

function getIncomeVsExpense({ startDate, endDate, groupBy = 'month' }) {
  const db = getDb();
  const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y';

  const rows = db.prepare(`
    SELECT strftime('${dateFormat}', t.date) AS period, c.type AS category_type, SUM(t.amount) AS total
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.date >= ? AND t.date <= ? AND t.transfer_group_id IS NULL
    GROUP BY period, c.type
    ORDER BY period ASC
  `).all(startDate, endDate);

  const byPeriod = new Map();
  for (const row of rows) {
    if (!byPeriod.has(row.period)) byPeriod.set(row.period, { period: row.period, income: 0, expense: 0 });
    const p = byPeriod.get(row.period);
    if (row.category_type === 'income') p.income = round2(p.income + row.total);
    else if (row.category_type === 'expense') p.expense = round2(p.expense + Math.abs(row.total));
  }

  return Array.from(byPeriod.values());
}

function getNetWorthOverTime({ startDate, endDate }) {
  const db = getDb();
  const accounts = db.prepare('SELECT id, opening_balance, type FROM accounts WHERE is_closed = 0').all();

  const months = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  while (cursor <= end) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const txSumStmt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE account_id = ? AND date <= ?
  `);

  return months.map(month => {
    const [y, m] = month.split('-').map(Number);
    // Day 0 of next month = last day of this month (handles Feb 28/29, 30 vs 31 day months correctly).
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
    let assets = 0, liabilities = 0;
    for (const acc of accounts) {
      const txTotal = txSumStmt.get(acc.id, monthEnd).total;
      const balance = acc.opening_balance + txTotal;
      if ((acc.type === 'credit' || acc.type === 'loan') && balance < 0) {
        liabilities += Math.abs(balance);
      } else {
        assets += balance;
      }
    }
    return { month, assets: round2(assets), liabilities: round2(liabilities), netWorth: round2(assets - liabilities) };
  });
}

module.exports = { getSpendingByCategory, getIncomeVsExpense, getNetWorthOverTime };
