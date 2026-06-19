const { getDb } = require('./db');

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function round4(n) {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

function listSecurities() {
  const db = getDb();
  return db.prepare('SELECT * FROM securities ORDER BY symbol ASC').all();
}

function upsertSecurity({ symbol, name, type, current_price }) {
  const db = getDb();
  if (!symbol || !symbol.trim()) throw new Error('Symbol is required');
  const sym = symbol.trim().toUpperCase();
  const existing = db.prepare('SELECT id FROM securities WHERE symbol = ?').get(sym);
  if (existing) {
    db.prepare(`
      UPDATE securities SET name = COALESCE(?, name), type = COALESCE(?, type),
        current_price = COALESCE(?, current_price), price_updated_at = datetime('now')
      WHERE id = ?
    `).run(name, type, current_price, existing.id);
    return db.prepare('SELECT * FROM securities WHERE id = ?').get(existing.id);
  }
  const result = db.prepare(`
    INSERT INTO securities (symbol, name, type, current_price, price_updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(sym, name || sym, type || 'stock', current_price || 0);
  return db.prepare('SELECT * FROM securities WHERE id = ?').get(result.lastInsertRowid);
}

function updateSecurityPrice(id, price) {
  const db = getDb();
  db.prepare(`UPDATE securities SET current_price = ?, price_updated_at = datetime('now') WHERE id = ?`).run(price, id);
  return db.prepare('SELECT * FROM securities WHERE id = ?').get(id);
}

function recordInvestmentTransaction(data) {
  const db = getDb();
  const { account_id, security_id, date, action, shares = 0, price = 0, commission = 0, memo } = data;
  if (!account_id || !security_id || !date || !action) {
    throw new Error('account_id, security_id, date, and action are required');
  }

  let amount = data.amount;
  if (amount === undefined) {
    if (action === 'buy' || action === 'reinvest') {
      amount = -round2(shares * price + commission);
    } else if (action === 'sell') {
      amount = round2(shares * price - commission);
    } else if (action === 'dividend') {
      amount = round2(price); // for dividends, 'price' carries the cash amount
    } else {
      amount = 0;
    }
  }

  const result = db.prepare(`
    INSERT INTO investment_transactions (account_id, security_id, date, action, shares, price, commission, amount, memo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(account_id, security_id, date, action, shares, price, commission, amount, memo || null);

  return db.prepare('SELECT * FROM investment_transactions WHERE id = ?').get(result.lastInsertRowid);
}

function getHoldings(accountId) {
  const db = getDb();
  const where = accountId ? 'WHERE it.account_id = ?' : '';
  const params = accountId ? [accountId] : [];

  const rows = db.prepare(`
    SELECT it.security_id, s.symbol, s.name, s.type, s.current_price,
           it.action, it.shares, it.price, it.commission, it.amount
    FROM investment_transactions it
    JOIN securities s ON s.id = it.security_id
    ${where}
    ORDER BY it.date ASC, it.id ASC
  `).all(...params);

  const bySecurity = new Map();

  for (const r of rows) {
    if (!bySecurity.has(r.security_id)) {
      bySecurity.set(r.security_id, {
        security_id: r.security_id, symbol: r.symbol, name: r.name, type: r.type,
        current_price: r.current_price, shares: 0, costBasis: 0,
      });
    }
    const h = bySecurity.get(r.security_id);

    switch (r.action) {
      case 'buy':
      case 'reinvest':
      case 'add_shares':
        h.shares = round4(h.shares + r.shares);
        h.costBasis = round2(h.costBasis + Math.abs(r.amount));
        break;
      case 'sell':
      case 'remove_shares': {
        // Average-cost method: reduce cost basis proportionally to shares removed.
        const avgCost = h.shares > 0 ? h.costBasis / h.shares : 0;
        h.shares = round4(h.shares - r.shares);
        h.costBasis = round2(Math.max(0, h.costBasis - avgCost * r.shares));
        break;
      }
      case 'split':
        // 'shares' holds the net change in share count for the split.
        h.shares = round4(h.shares + r.shares);
        break;
      case 'dividend':
        // Cash dividend: no share or cost-basis effect.
        break;
      default:
        break;
    }
  }

  return Array.from(bySecurity.values())
    .filter(h => h.shares > 0.0001)
    .map(h => {
      const marketValue = round2(h.shares * h.current_price);
      const gainLoss = round2(marketValue - h.costBasis);
      const gainLossPct = h.costBasis > 0 ? round2((gainLoss / h.costBasis) * 100) : 0;
      return { ...h, marketValue, gainLoss, gainLossPct };
    });
}

function getPortfolioSummary(accountId) {
  const holdings = getHoldings(accountId);
  const totalValue = round2(holdings.reduce((sum, h) => sum + h.marketValue, 0));
  const totalCost = round2(holdings.reduce((sum, h) => sum + h.costBasis, 0));
  const totalGainLoss = round2(totalValue - totalCost);
  return { holdings, totalValue, totalCost, totalGainLoss };
}

function listInvestmentTransactions(accountId) {
  const db = getDb();
  return db.prepare(`
    SELECT it.*, s.symbol, s.name AS security_name
    FROM investment_transactions it
    JOIN securities s ON s.id = it.security_id
    WHERE it.account_id = ?
    ORDER BY it.date DESC, it.id DESC
  `).all(accountId);
}

module.exports = {
  listSecurities, upsertSecurity, updateSecurityPrice, recordInvestmentTransaction,
  getHoldings, getPortfolioSummary, listInvestmentTransactions,
};
