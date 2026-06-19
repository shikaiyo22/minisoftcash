# Money Manager

A standalone, offline personal finance manager for Windows, inspired by Microsoft Money.
Built with Electron + SQLite. All data is stored locally on your machine — nothing is sent
to any server.

## Features

- **Accounts** — checking, savings, credit card, cash, investment, loan, and asset accounts
- **Transactions** — full ledger with running balances, split transactions, account transfers,
  reconciliation status (unreconciled / cleared / reconciled), search
- **Budgeting** — monthly category budgets with spend tracking and progress bars, copy-from-previous-month
- **Investments** — securities, buy/sell/dividend/reinvest transactions, average-cost-basis
  holdings calculation, gain/loss tracking
- **Reports** — spending by category (donut chart), income vs. expense by month (bar chart),
  net worth trend over time (line chart)
- **Categories** — hierarchical income/expense categories with sensible defaults pre-seeded

## How your data is stored

Money Manager uses a local SQLite database file. You can find its exact location from the
app menu: Help -> Show Database Location. On Windows this is typically:

```
C:\Users\<you>\AppData\Roaming\Money Manager\money-manager.sqlite3
```

Back this file up periodically (just copy it) — there is no cloud sync built in.

---

## Getting the Windows installer (.exe)

This project was built in a Linux sandbox, which cannot compile the native SQLite module
or produce a real Windows .exe. There are two ways to get a working installer:

### Option A — Let GitHub build it for you (recommended, no local setup needed)

1. Create a new repository on GitHub and push this project's contents to it.
2. The included workflow at `.github/workflows/build-windows.yml` runs automatically
   on every push to `main`, and can also be run manually from the Actions tab
   (`Run workflow` button).
3. Once it finishes (a few minutes), open the workflow run and download the
   `Money-Manager-Windows-Installer` artifact — it contains
   `Money Manager-Setup-1.0.0.exe`.
4. Run that installer on any Windows machine. No Node.js or build tools needed on your PC.

### Option B — Build it yourself on a Windows machine

Requirements: Node.js 20 LTS (from nodejs.org) and Python (used by the native module
build tooling; the official Node.js Windows installer can install this for you, or use
`winget install Python.Python.3`).

```powershell
git clone <your-repo-url>
cd money-manager
npm install
npm run dist:win
```

The installer will be created at `release\Money Manager-Setup-1.0.0.exe`.

### Running in development mode (no installer, just run it)

```powershell
npm install
npm start
```

---

## Project structure

```
src/
  main/             Electron main process (window, menu, IPC handlers, preload bridge)
  database/         SQLite schema + all data access logic (accounts, transactions, budgets, ...)
  renderer/         Frontend UI (vanilla HTML/CSS/JS, no framework)
    js/view-*.js    One file per screen (dashboard, accounts, ledger, budget, investments, reports, categories)
build/icon.ico      Application icon used by the Windows installer
.github/workflows/  CI workflow that builds the Windows installer on GitHub's servers
```

## Testing

The repository includes a test suite (`test/run-tests.js`) that exercises the real database
logic — account balances, split transactions, transfers (including the two-leg sync logic),
budget aggregation across splits, investment cost-basis accounting, and report calculations —
against an actual SQLite engine. It does not require `better-sqlite3` to be compiled, so it
can run in restricted or offline environments too:

```bash
node --no-warnings test/run-tests.js
```

## Known limitations

- No bank sync or OFX import — transactions are entered manually.
- Reconciliation is a status flag per transaction, not a guided reconcile-to-statement wizard.
- Multi-currency accounts store a currency code per account but do not convert between currencies.
- The application icon (`build/icon.ico`) is a simple placeholder — swap it for your own icon
  if you would like a custom one (any 256x256 .ico will work).
