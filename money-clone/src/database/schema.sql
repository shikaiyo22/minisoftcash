-- Money Manager Database Schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('checking','savings','credit','cash','investment','loan','asset')),
    institution TEXT,
    account_number TEXT,
    opening_balance REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    credit_limit REAL,
    notes TEXT,
    is_closed INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense')),
    parent_id INTEGER,
    icon TEXT,
    color TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    UNIQUE(name, type, parent_id)
);

CREATE TABLE IF NOT EXISTS payees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    default_category_id INTEGER,
    FOREIGN KEY (default_category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Transactions. For account transfers, two rows are created (one per account),
-- linked via a shared transfer_group_id, with opposite-signed amounts.
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    date TEXT NOT NULL,                      -- ISO date YYYY-MM-DD
    payee_id INTEGER,
    category_id INTEGER,
    amount REAL NOT NULL,                     -- positive = inflow, negative = outflow
    memo TEXT,
    check_number TEXT,
    status TEXT NOT NULL DEFAULT 'unreconciled' CHECK(status IN ('unreconciled','cleared','reconciled')),
    transfer_group_id TEXT,
    is_split_parent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (payee_id) REFERENCES payees(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transaction_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    category_id INTEGER,
    amount REAL NOT NULL,
    memo TEXT,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    month TEXT NOT NULL,                      -- 'YYYY-MM'
    amount REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(category_id, month)
);

CREATE TABLE IF NOT EXISTS securities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,
    name TEXT,
    type TEXT NOT NULL DEFAULT 'stock' CHECK(type IN ('stock','etf','mutual_fund','bond','crypto','other')),
    current_price REAL NOT NULL DEFAULT 0,
    price_updated_at TEXT
);

CREATE TABLE IF NOT EXISTS investment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    security_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('buy','sell','dividend','reinvest','split','add_shares','remove_shares')),
    shares REAL NOT NULL DEFAULT 0,
    price REAL NOT NULL DEFAULT 0,
    commission REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0,
    memo TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payee ON transactions(payee_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group ON transactions(transfer_group_id);
CREATE INDEX IF NOT EXISTS idx_splits_transaction ON transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_invtx_account ON investment_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_invtx_security ON investment_transactions(security_id);
CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);
