const crypto = require('crypto');
const { getDb } = require('./db');

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function listTransactions({ accountId, startDate, endDate, categoryId, payeeId, search, limit, offset } = {}) {
  const db = getDb();
  const conditions = [];
  const params = {};

  if (accountId) { conditions.push('t.account_id = @accountId'); params.accountId = accountId; }
  if (startDate) { conditions.push('t.date >= @startDate'); params.startDate = startDate; }
  if (endDate) { conditions.push('t.date <= @endDate'); params.endDate = endDate; }
  if (categoryId) { conditions.push('t.category_id = @categoryId'); params.categoryId = categoryId; }
  if (payeeId) { conditions.push('t.payee_id = @payeeId'); params.payeeId = payeeId; }
  if (search) { conditions.push('(p.name LIKE @search OR t.memo LIKE @search)'); params.search = `%${search}%`; }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  let limitClause = '';
  if (limit) { limitClause = 'LIMIT @limit OFFSET @offset'; params.limit = limit; params.offset = offset || 0; }

  const rows = db.prepare(`
    SELECT t.*, p.name AS payee_name, c.name AS category_name, c.type AS category_type,
           a.name AS account_name
    FROM transactions t
    LEFT JOIN payees p ON p.id = t.payee_id
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN accounts a ON a.id = t.account_id
    ${whereClause}
    ORDER BY t.date DESC, t.id DESC
    ${limitClause}
  `).all(params);

  const splitStmt = db.prepare(`
    SELECT s.*, c.name AS category_name FROM transaction_splits s
    LEFT JOIN categories c ON c.id = s.category_id
    WHERE s.transaction_id = ?
  `);
  for (const row of rows) {
    if (row.is_split_parent) row.splits = splitStmt.all(row.id);
  }

  return rows;
}

function listTransactionsWithBalance(accountId) {
  const db = getDb();
  const account = db.prepare('SELECT opening_balance FROM accounts WHERE id = ?').get(accountId);
  if (!account) return [];

  const rows = db.prepare(`
    SELECT t.*, p.name AS payee_name, c.name AS category_name, c.type AS category_type
    FROM transactions t
    LEFT JOIN payees p ON p.id = t.payee_id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.account_id = ?
    ORDER BY t.date ASC, t.id ASC
  `).all(accountId);

  let running = account.opening_balance;
  const splitStmt = db.prepare(`
    SELECT s.*, c.name AS category_name FROM transaction_splits s
    LEFT JOIN categories c ON c.id = s.category_id
    WHERE s.transaction_id = ?
  `);
  for (const row of rows) {
    running = round2(running + row.amount);
    row.running_balance = running;
    if (row.is_split_parent) row.splits = splitStmt.all(row.id);
  }

  // Computed oldest-first for correct running balances; displayed newest-first.
  return rows.reverse();
}

function getPayeeId(db, payeeName) {
  if (!payeeName || !payeeName.trim()) return null;
  const name = payeeName.trim();
  const existing = db.prepare('SELECT id FROM payees WHERE name = ?').get(name);
  if (existing) return existing.id;
  const result = db.prepare('INSERT INTO payees (name) VALUES (?)').run(name);
  return result.lastInsertRowid;
}

function createTransaction(data) {
  const db = getDb();
  if (!data.account_id) throw new Error('account_id is required');
  if (!data.date) throw new Error('date is required');
  if (data.amount === undefined || data.amount === null || isNaN(data.amount)) {
    throw new Error('amount is required and must be a number');
  }

  const insertTx = db.transaction(() => {
    const payeeId = data.payee_id || getPayeeId(db, data.payee_name);
    const hasSplits = Array.isArray(data.splits) && data.splits.length > 0;

    const result = db.prepare(`
      INSERT INTO transactions (account_id, date, payee_id, category_id, amount, memo, check_number, status, is_split_parent)
      VALUES (@account_id, @date, @payee_id, @category_id, @amount, @memo, @check_number, @status, @is_split_parent)
    `).run({
      account_id: data.account_id,
      date: data.date,
      payee_id: payeeId,
      category_id: hasSplits ? null : (data.category_id || null),
      amount: data.amount,
      memo: data.memo || null,
      check_number: data.check_number || null,
      status: data.status || 'unreconciled',
      is_split_parent: hasSplits ? 1 : 0,
    });

    const txId = result.lastInsertRowid;

    if (hasSplits) {
      const splitTotal = data.splits.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(round2(splitTotal) - round2(data.amount)) > 0.005) {
        throw new Error(`Split total (${splitTotal}) does not match transaction amount (${data.amount})`);
      }
      const insertSplit = db.prepare(
        'INSERT INTO transaction_splits (transaction_id, category_id, amount, memo) VALUES (?, ?, ?, ?)'
      );
      for (const split of data.splits) {
        insertSplit.run(txId, split.category_id || null, split.amount, split.memo || null);
      }
    }

    return txId;
  });

  const txId = insertTx();
  return getTransaction(txId);
}

function createTransfer({ fromAccountId, toAccountId, date, amount, memo }) {
  if (!fromAccountId || !toAccountId) throw new Error('fromAccountId and toAccountId are required');
  if (fromAccountId === toAccountId) throw new Error('Cannot transfer to the same account');
  if (!amount || isNaN(amount) || amount <= 0) throw new Error('amount must be a positive number');

  const db = getDb();
  const groupId = crypto.randomUUID();

  const insertTransfer = db.transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO transactions (account_id, date, amount, memo, transfer_group_id, status)
      VALUES (?, ?, ?, ?, ?, 'unreconciled')
    `);
    const outResult = stmt.run(fromAccountId, date, -Math.abs(amount), memo || null, groupId);
    const inResult = stmt.run(toAccountId, date, Math.abs(amount), memo || null, groupId);
    return [outResult.lastInsertRowid, inResult.lastInsertRowid];
  });

  const [outId, inId] = insertTransfer();
  return { out: getTransaction(outId), in: getTransaction(inId) };
}

function getTransaction(id) {
  const db = getDb();
  const row = db.prepare(`
    SELECT t.*, p.name AS payee_name, c.name AS category_name
    FROM transactions t
    LEFT JOIN payees p ON p.id = t.payee_id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.id = ?
  `).get(id);
  if (!row) return null;
  if (row.is_split_parent) {
    row.splits = db.prepare(`
      SELECT s.*, c.name AS category_name FROM transaction_splits s
      LEFT JOIN categories c ON c.id = s.category_id
      WHERE s.transaction_id = ?
    `).all(id);
  }
  return row;
}

function updateTransaction(id, data) {
  const db = getDb();

  const updateTx = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!existing) throw new Error('Transaction not found');

    // Keep both legs of a transfer in sync for date/amount.
    if (existing.transfer_group_id && (data.amount !== undefined || data.date !== undefined)) {
      const otherLeg = db.prepare(
        'SELECT * FROM transactions WHERE transfer_group_id = ? AND id != ?'
      ).get(existing.transfer_group_id, id);
      if (otherLeg) {
        const newAmount = data.amount !== undefined ? data.amount : existing.amount;
        // The other leg must always carry the opposite sign and equal magnitude.
        const otherAmount = newAmount >= 0 ? -Math.abs(newAmount) : Math.abs(newAmount);
        db.prepare(`UPDATE transactions SET amount = @amount, date = @date, updated_at = datetime('now') WHERE id = @id`)
          .run({ amount: otherAmount, date: data.date || otherLeg.date, id: otherLeg.id });
      }
    }

    const payeeId = data.payee_id !== undefined
      ? data.payee_id
      : (data.payee_name !== undefined ? getPayeeId(db, data.payee_name) : existing.payee_id);
    const hasSplits = Array.isArray(data.splits) && data.splits.length > 0;

    db.prepare(`
      UPDATE transactions SET
        date = @date, payee_id = @payee_id, category_id = @category_id,
        amount = @amount, memo = @memo, check_number = @check_number,
        status = @status, is_split_parent = @is_split_parent, updated_at = datetime('now')
      WHERE id = @id
    `).run({
      date: data.date ?? existing.date,
      payee_id: payeeId,
      category_id: hasSplits ? null : (data.category_id !== undefined ? data.category_id : existing.category_id),
      amount: data.amount ?? existing.amount,
      memo: data.memo !== undefined ? data.memo : existing.memo,
      check_number: data.check_number !== undefined ? data.check_number : existing.check_number,
      status: data.status ?? existing.status,
      is_split_parent: hasSplits ? 1 : (data.splits !== undefined ? 0 : existing.is_split_parent),
      id,
    });

    if (data.splits !== undefined) {
      db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').run(id);
      if (hasSplits) {
        const finalAmount = data.amount ?? existing.amount;
        const splitTotal = data.splits.reduce((sum, s) => sum + s.amount, 0);
        if (Math.abs(round2(splitTotal) - round2(finalAmount)) > 0.005) {
          throw new Error(`Split total (${splitTotal}) does not match transaction amount (${finalAmount})`);
        }
        const insertSplit = db.prepare(
          'INSERT INTO transaction_splits (transaction_id, category_id, amount, memo) VALUES (?, ?, ?, ?)'
        );
        for (const split of data.splits) {
          insertSplit.run(id, split.category_id || null, split.amount, split.memo || null);
        }
      }
    }
  });

  updateTx();
  return getTransaction(id);
}

function deleteTransaction(id) {
  const db = getDb();
  const deleteTx = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!existing) return false;
    if (existing.transfer_group_id) {
      db.prepare('DELETE FROM transactions WHERE transfer_group_id = ?').run(existing.transfer_group_id);
    } else {
      db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    }
    return true;
  });
  return deleteTx();
}

module.exports = {
  listTransactions, listTransactionsWithBalance, createTransaction, createTransfer,
  getTransaction, updateTransaction, deleteTransaction,
};
