const { ipcMain } = require('electron');
const accounts = require('../database/accounts');
const transactions = require('../database/transactions');
const categories = require('../database/categories');
const budgets = require('../database/budgets');
const investments = require('../database/investments');
const reports = require('../database/reports');
const { getDbPath } = require('../database/db');

// Wraps a handler so thrown errors become a structured { error } response
// instead of an unhandled rejection that's hard to debug from the renderer.
function safe(fn) {
  return async (event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      console.error('IPC error:', err);
      return { ok: false, error: err.message || String(err) };
    }
  };
}

function registerIpcHandlers() {
  // Accounts
  ipcMain.handle('accounts:list', safe((opts) => accounts.listAccounts(opts || {})));
  ipcMain.handle('accounts:get', safe((id) => accounts.getAccount(id)));
  ipcMain.handle('accounts:create', safe((data) => accounts.createAccount(data)));
  ipcMain.handle('accounts:update', safe((id, data) => accounts.updateAccount(id, data)));
  ipcMain.handle('accounts:delete', safe((id) => accounts.deleteAccount(id)));
  ipcMain.handle('accounts:netWorth', safe(() => accounts.getTotalNetWorth()));

  // Transactions
  ipcMain.handle('transactions:list', safe((filters) => transactions.listTransactions(filters || {})));
  ipcMain.handle('transactions:listWithBalance', safe((accountId) => transactions.listTransactionsWithBalance(accountId)));
  ipcMain.handle('transactions:get', safe((id) => transactions.getTransaction(id)));
  ipcMain.handle('transactions:create', safe((data) => transactions.createTransaction(data)));
  ipcMain.handle('transactions:createTransfer', safe((data) => transactions.createTransfer(data)));
  ipcMain.handle('transactions:update', safe((id, data) => transactions.updateTransaction(id, data)));
  ipcMain.handle('transactions:delete', safe((id) => transactions.deleteTransaction(id)));

  // Categories
  ipcMain.handle('categories:list', safe(() => categories.listCategories()));
  ipcMain.handle('categories:tree', safe(() => categories.listCategoriesTree()));
  ipcMain.handle('categories:create', safe((data) => categories.createCategory(data)));
  ipcMain.handle('categories:update', safe((id, data) => categories.updateCategory(id, data)));
  ipcMain.handle('categories:delete', safe((id) => categories.deleteCategory(id)));

  // Payees
  ipcMain.handle('payees:list', safe(() => categories.listPayees()));

  // Budgets
  ipcMain.handle('budgets:getForMonth', safe((month) => budgets.getBudgetForMonth(month)));
  ipcMain.handle('budgets:setAmount', safe((categoryId, month, amount) => budgets.setBudgetAmount(categoryId, month, amount)));
  ipcMain.handle('budgets:copyFromPreviousMonth', safe((month) => budgets.copyBudgetFromPreviousMonth(month)));

  // Investments
  ipcMain.handle('investments:listSecurities', safe(() => investments.listSecurities()));
  ipcMain.handle('investments:upsertSecurity', safe((data) => investments.upsertSecurity(data)));
  ipcMain.handle('investments:updateSecurityPrice', safe((id, price) => investments.updateSecurityPrice(id, price)));
  ipcMain.handle('investments:recordTransaction', safe((data) => investments.recordInvestmentTransaction(data)));
  ipcMain.handle('investments:getHoldings', safe((accountId) => investments.getHoldings(accountId)));
  ipcMain.handle('investments:getPortfolioSummary', safe((accountId) => investments.getPortfolioSummary(accountId)));
  ipcMain.handle('investments:listTransactions', safe((accountId) => investments.listInvestmentTransactions(accountId)));

  // Reports
  ipcMain.handle('reports:spendingByCategory', safe((range) => reports.getSpendingByCategory(range)));
  ipcMain.handle('reports:incomeVsExpense', safe((range) => reports.getIncomeVsExpense(range)));
  ipcMain.handle('reports:netWorthOverTime', safe((range) => reports.getNetWorthOverTime(range)));

  // System
  ipcMain.handle('system:getDbPath', safe(() => getDbPath()));
}

module.exports = registerIpcHandlers;
