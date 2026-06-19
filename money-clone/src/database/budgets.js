const { getDb } = require('./db');

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getBudgetForMonth(month) {
  const db = getDb();

  const categories = db.prepare(`
    SELECT id, name, type, parent_id FROM categories WHERE type = 'expense' ORDER BY name ASC
  `).all();

  const budgetRows = db.prepare('SELECT * FROM budgets WHERE month = ?').all(month);
  const budgetByCategory = new Map(budgetRows.map(b => [b.category_id, b.amount]));

  const directSpend = db.prepare(`
    SELECT category_id, SUM(amount) AS total
    FROM transactions
    WHERE category_id IS NOT NULL AND is_split_parent = 0 AND strftime('%Y-%m', date) = ?
    GROUP BY category_id
  `).all(month);

  const splitSpend = db.prepare(`
    SELECT s.category_id, SUM(s.amount) AS total
    FROM transaction_splits s
    JOIN transactions t ON t.id = s.transaction_id
    WHERE s.category_id IS NOT NULL AND strftime('%Y-%m', t.date) = ?
    GROUP BY s.category_id
  `).all(month);

  const spendByCategory = new Map();
  for (const row of directSpend) spendByCategory.set(row.category_id, (spendByCategory.get(row.category_id) || 0) + row.total);
  for (const row of splitSpend) spendByCategory.set(row.category_id, (spendByCategory.get(row.category_id) || 0) + row.total);

  return categories.map(cat => {
    const budgeted = budgetByCategory.get(cat.id) || 0;
    const spentRaw = spendByCategory.get(cat.id) || 0;
    // Expense transactions are stored negative; "spent" should read as a positive number.
    const actualSpent = round2(spentRaw < 0 ? -spentRaw : 0);
    return {
      category_id: cat.id,
      category_name: cat.name,
      parent_id: cat.parent_id,
      budgeted: round2(budgeted),
      spent: actualSpent,
      remaining: round2(budgeted - actualSpent),
    };
  });
}

function setBudgetAmount(categoryId, month, amount) {
  const db = getDb();
  db.prepare(`
    INSERT INTO budgets (category_id, month, amount) VALUES (?, ?, ?)
    ON CONFLICT(category_id, month) DO UPDATE SET amount = excluded.amount
  `).run(categoryId, month, amount);
  return { category_id: categoryId, month, amount };
}

function copyBudgetFromPreviousMonth(month) {
  const db = getDb();
  const [y, m] = month.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1); // m is 1-indexed; m-2 yields the previous month's index
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const rows = db.prepare('SELECT category_id, amount FROM budgets WHERE month = ?').all(prevMonth);

  const insertMany = db.transaction((items) => {
    for (const item of items) setBudgetAmount(item.category_id, month, item.amount);
  });
  insertMany(rows);
  return getBudgetForMonth(month);
}

module.exports = { getBudgetForMonth, setBudgetAmount, copyBudgetFromPreviousMonth };
