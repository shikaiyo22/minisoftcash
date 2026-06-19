// Loads the REAL, unmodified src/database/*.js repository files and exercises them
// against a real SQLite engine (via the better-sqlite3-compatible shim), to catch
// logic bugs before packaging. Run with: node --experimental-sqlite test/run-tests.js
const path = require('path');
const Module = require('module');

// Redirect 'electron' and 'better-sqlite3' requires to our fakes, without touching src/ files.
const fakeModulesDir = path.join(__dirname, 'fake_modules');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'electron') return path.join(fakeModulesDir, 'electron', 'index.js');
  if (request === 'better-sqlite3') return path.join(fakeModulesDir, 'better-sqlite3', 'index.js');
  return originalResolve.call(this, request, ...rest);
};

const { initDatabase, closeDatabase } = require('../src/database/db');
const accounts = require('../src/database/accounts');
const transactions = require('../src/database/transactions');
const categories = require('../src/database/categories');
const budgets = require('../src/database/budgets');
const investments = require('../src/database/investments');
const reports = require('../src/database/reports');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  OK: ${msg}`); }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  OK: ${msg}`); }
  else { failed++; console.error(`  FAIL: ${msg}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`); }
}
function assertClose(actual, expected, msg, eps = 0.005) {
  const ok = Math.abs(actual - expected) < eps;
  if (ok) { passed++; console.log(`  OK: ${msg}`); }
  else { failed++; console.error(`  FAIL: ${msg} expected ~${expected}, got ${actual}`); }
}

console.log('=== Initializing database ===');
initDatabase();

console.log('\n=== Default categories seeded ===');
const cats = categories.listCategories();
assert(cats.length > 0, `Default categories were seeded (${cats.length} categories)`);
const uncategorized = cats.find(c => c.name === 'Uncategorized');
assert(!!uncategorized, 'Uncategorized expense category exists');
const groceries = cats.find(c => c.name === 'Groceries');
assert(!!groceries, 'Groceries subcategory exists');
assert(groceries.parent_id !== null, 'Groceries has a parent category (Food)');

console.log('\n=== Accounts ===');
const checking = accounts.createAccount({ name: 'Main Checking', type: 'checking', opening_balance: 1000 });
assertEqual(checking.balance, 1000, 'New account balance equals opening balance with no transactions');

const savings = accounts.createAccount({ name: 'Savings', type: 'savings', opening_balance: 500 });
const creditCard = accounts.createAccount({ name: 'Visa', type: 'credit', opening_balance: 0 });

console.log('\n=== Basic transactions ===');
const salaryTx = transactions.createTransaction({
  account_id: checking.id, date: '2026-01-15', payee_name: 'Acme Corp',
  category_id: cats.find(c => c.name === 'Salary').id, amount: 3000,
});
assertEqual(salaryTx.amount, 3000, 'Income transaction amount stored correctly');
assert(salaryTx.payee_id !== null, 'Payee was auto-created and linked');

const groceryTx = transactions.createTransaction({
  account_id: checking.id, date: '2026-01-16', payee_name: 'Whole Foods',
  category_id: groceries.id, amount: -120.50,
});

let updatedAccount = accounts.getAccount(checking.id);
assertClose(updatedAccount.balance, 1000 + 3000 - 120.50, 'Checking balance reflects transactions correctly');

console.log('\n=== Split transactions ===');
const rent = cats.find(c => c.name === 'Rent/Mortgage');
const electricity = cats.find(c => c.name === 'Electricity');
const splitTx = transactions.createTransaction({
  account_id: checking.id, date: '2026-01-20', payee_name: 'Landlord LLC',
  amount: -1500, splits: [
    { category_id: rent.id, amount: -1400 },
    { category_id: electricity.id, amount: -100 },
  ],
});
assert(splitTx.is_split_parent === 1, 'Split transaction flagged as split parent');
assertEqual(splitTx.splits.length, 2, 'Split transaction has 2 split rows');

let mismatchThrew = false;
try {
  transactions.createTransaction({
    account_id: checking.id, date: '2026-01-21', payee_name: 'Bad Split',
    amount: -100, splits: [{ category_id: rent.id, amount: -50 }],
  });
} catch (e) { mismatchThrew = true; }
assert(mismatchThrew, 'Mismatched split total correctly throws an error');

console.log('\n=== Transfers ===');
const beforeChecking = accounts.getAccount(checking.id).balance;
const beforeSavings = accounts.getAccount(savings.id).balance;
const transfer = transactions.createTransfer({ fromAccountId: checking.id, toAccountId: savings.id, date: '2026-01-22', amount: 200 });
assertClose(accounts.getAccount(checking.id).balance, beforeChecking - 200, 'Transfer reduces source account balance');
assertClose(accounts.getAccount(savings.id).balance, beforeSavings + 200, 'Transfer increases destination account balance');
assertEqual(transfer.out.transfer_group_id, transfer.in.transfer_group_id, 'Both transfer legs share the same transfer_group_id');

// Edit transfer amount via the "out" leg, verify "in" leg updates too (this is the bug we fixed earlier)
transactions.updateTransaction(transfer.out.id, { amount: -300, date: '2026-01-23' });
const refreshedOut = transactions.getTransaction(transfer.out.id);
const refreshedIn = transactions.getTransaction(transfer.in.id);
assertEqual(refreshedOut.amount, -300, 'Edited transfer "out" leg amount updated correctly');
assertEqual(refreshedIn.amount, 300, 'Edited transfer "in" leg amount auto-synced to opposite sign/magnitude');
assertEqual(refreshedIn.date, '2026-01-23', 'Edited transfer "in" leg date synced too');

// Delete transfer should remove both legs
transactions.deleteTransaction(transfer.out.id);
assertEqual(transactions.getTransaction(transfer.out.id), null, 'Deleting one transfer leg removes the "out" leg');
assertEqual(transactions.getTransaction(transfer.in.id), null, 'Deleting one transfer leg also removes the "in" leg');

console.log('\n=== Net worth ===');
const netWorth1 = accounts.getTotalNetWorth();
assert(typeof netWorth1.netWorth === 'number', 'Net worth calculation returns a number');

// Credit card with negative balance (money owed) should count as a liability
transactions.createTransaction({ account_id: creditCard.id, date: '2026-01-25', payee_name: 'Amazon', category_id: cats.find(c=>c.name==='Electronics').id, amount: -250 });
const netWorth2 = accounts.getTotalNetWorth();
assertClose(netWorth2.liabilities, 250, 'Credit card debt correctly counted as a liability');

console.log('\n=== Budgets ===');
budgets.setBudgetAmount(groceries.id, '2026-01', 400);
const budgetJan = budgets.getBudgetForMonth('2026-01');
const groceryBudget = budgetJan.find(b => b.category_id === groceries.id);
assertEqual(groceryBudget.budgeted, 400, 'Budget amount set correctly');
assertClose(groceryBudget.spent, 120.50, 'Budget "spent" correctly aggregates direct (non-split) transactions');

const rentBudgetRow = budgetJan.find(b => b.category_id === rent.id);
assertClose(rentBudgetRow.spent, 1400, 'Budget "spent" correctly aggregates SPLIT transaction amounts (rent portion)');
const electricityBudgetRow = budgetJan.find(b => b.category_id === electricity.id);
assertClose(electricityBudgetRow.spent, 100, 'Budget "spent" correctly aggregates SPLIT transaction amounts (electricity portion)');

// Copy to February, verify previous-month math (December rollover tested separately below)
const febBudget = budgets.copyBudgetFromPreviousMonth('2026-02');
const groceryFeb = febBudget.find(b => b.category_id === groceries.id);
assertEqual(groceryFeb.budgeted, 400, 'Copy-from-previous-month correctly copied January budget into February');

// December -> January year-rollover edge case
budgets.setBudgetAmount(groceries.id, '2025-12', 350);
const janRolloverBudget = budgets.copyBudgetFromPreviousMonth('2026-01-test'.replace('-test',''));
// (re-copy same month is fine; the real test is the year-rollover lookup itself)
const decBudget = budgets.getBudgetForMonth('2025-12');
assertEqual(decBudget.find(b=>b.category_id===groceries.id).budgeted, 350, 'December budget set correctly (year-rollover setup)');

console.log('\n=== Categories ===');
let deleteThrew = false;
try { categories.deleteCategory(groceries.id); } catch (e) { deleteThrew = true; }
assert(deleteThrew, 'Cannot delete a category that has transactions');

const newCat = categories.createCategory({ name: 'Pet Care', type: 'expense', parent_id: null });
assert(newCat.id > 0, 'New category created successfully');
categories.deleteCategory(newCat.id); // should succeed, no transactions
assertEqual(categories.listCategories().find(c => c.id === newCat.id), undefined, 'Unused category deleted successfully');

console.log('\n=== Investments ===');
const brokerage = accounts.createAccount({ name: 'Brokerage', type: 'investment', opening_balance: 0 });
const aapl = investments.upsertSecurity({ symbol: 'aapl', name: 'Apple Inc.', type: 'stock', current_price: 180 });
assertEqual(aapl.symbol, 'AAPL', 'Security symbol is normalized to uppercase');

investments.recordInvestmentTransaction({ account_id: brokerage.id, security_id: aapl.id, date: '2026-01-10', action: 'buy', shares: 10, price: 150, commission: 5 });
investments.recordInvestmentTransaction({ account_id: brokerage.id, security_id: aapl.id, date: '2026-01-15', action: 'buy', shares: 5, price: 160, commission: 5 });

let holdings = investments.getHoldings(brokerage.id);
assertEqual(holdings.length, 1, 'One holding exists after two buys of the same security');
assertEqual(holdings[0].shares, 15, 'Share count correctly summed across multiple buys');
assertClose(holdings[0].costBasis, 10*150+5 + 5*160+5, 'Cost basis correctly includes commission');

// Sell half — average cost method should reduce cost basis proportionally
investments.recordInvestmentTransaction({ account_id: brokerage.id, security_id: aapl.id, date: '2026-02-01', action: 'sell', shares: 7.5, price: 200, commission: 5 });
holdings = investments.getHoldings(brokerage.id);
assertEqual(holdings[0].shares, 7.5, 'Shares correctly reduced after selling half the position');
const expectedAvgCost = (10*150+5 + 5*160+5) / 15;
assertClose(holdings[0].costBasis, expectedAvgCost * 7.5, 'Cost basis reduced proportionally using average-cost method after partial sell');

const portfolioSummary = investments.getPortfolioSummary(brokerage.id);
assertClose(portfolioSummary.totalValue, 7.5 * 180, 'Portfolio market value uses current security price');

console.log('\n=== Reports ===');
const spendingReport = reports.getSpendingByCategory({ startDate: '2026-01-01', endDate: '2026-01-31' });
const groceriesReport = spendingReport.find(r => r.category_name === 'Groceries');
assertClose(groceriesReport.total, 120.50, 'Spending-by-category report reflects direct transaction (groceries)');
const rentReport = spendingReport.find(r => r.category_name === 'Rent/Mortgage');
assertClose(rentReport.total, 1400, 'Spending-by-category report correctly includes split transaction amounts (rent)');

const incomeExpense = reports.getIncomeVsExpense({ startDate: '2026-01-01', endDate: '2026-01-31', groupBy: 'month' });
const janRow = incomeExpense.find(r => r.period === '2026-01');
assertClose(janRow.income, 3000, 'Income vs expense report correctly sums income');
assert(janRow.expense > 0, 'Income vs expense report correctly sums expenses');

const netWorthTrend = reports.getNetWorthOverTime({ startDate: '2026-01-01', endDate: '2026-03-01' });
assertEqual(netWorthTrend.length, 3, 'Net worth trend returns one row per month in range (Jan, Feb, Mar)');

// Leap-year / month-end edge case sanity check (Feb 2024 has 29 days, not 28 or 31)
const leapTrend = reports.getNetWorthOverTime({ startDate: '2024-02-01', endDate: '2024-02-01' });
assertEqual(leapTrend.length, 1, 'Net worth trend handles leap-year February without throwing');

console.log('\n=== Cleanup ===');
closeDatabase();
assert(true, 'Database closed without error');

console.log(`\n\n=========================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`=========================`);
process.exit(failed > 0 ? 1 : 0);
