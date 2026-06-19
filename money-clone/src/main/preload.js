const { contextBridge, ipcRenderer } = require('electron');

// Whitelist of valid IPC channels, mirrored on the main-process side in ipc-handlers.js.
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  accounts: {
    list: (opts) => invoke('accounts:list', opts),
    get: (id) => invoke('accounts:get', id),
    create: (data) => invoke('accounts:create', data),
    update: (id, data) => invoke('accounts:update', id, data),
    delete: (id) => invoke('accounts:delete', id),
    netWorth: () => invoke('accounts:netWorth'),
  },
  transactions: {
    list: (filters) => invoke('transactions:list', filters),
    listWithBalance: (accountId) => invoke('transactions:listWithBalance', accountId),
    get: (id) => invoke('transactions:get', id),
    create: (data) => invoke('transactions:create', data),
    createTransfer: (data) => invoke('transactions:createTransfer', data),
    update: (id, data) => invoke('transactions:update', id, data),
    delete: (id) => invoke('transactions:delete', id),
  },
  categories: {
    list: () => invoke('categories:list'),
    tree: () => invoke('categories:tree'),
    create: (data) => invoke('categories:create', data),
    update: (id, data) => invoke('categories:update', id, data),
    delete: (id) => invoke('categories:delete', id),
  },
  payees: {
    list: () => invoke('payees:list'),
  },
  budgets: {
    getForMonth: (month) => invoke('budgets:getForMonth', month),
    setAmount: (categoryId, month, amount) => invoke('budgets:setAmount', categoryId, month, amount),
    copyFromPreviousMonth: (month) => invoke('budgets:copyFromPreviousMonth', month),
  },
  investments: {
    listSecurities: () => invoke('investments:listSecurities'),
    upsertSecurity: (data) => invoke('investments:upsertSecurity', data),
    updateSecurityPrice: (id, price) => invoke('investments:updateSecurityPrice', id, price),
    recordTransaction: (data) => invoke('investments:recordTransaction', data),
    getHoldings: (accountId) => invoke('investments:getHoldings', accountId),
    getPortfolioSummary: (accountId) => invoke('investments:getPortfolioSummary', accountId),
    listTransactions: (accountId) => invoke('investments:listTransactions', accountId),
  },
  reports: {
    spendingByCategory: (range) => invoke('reports:spendingByCategory', range),
    incomeVsExpense: (range) => invoke('reports:incomeVsExpense', range),
    netWorthOverTime: (range) => invoke('reports:netWorthOverTime', range),
  },
  system: {
    getDbPath: () => invoke('system:getDbPath'),
  },
});
