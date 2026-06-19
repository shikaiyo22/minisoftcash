// Thin shim mimicking the subset of the better-sqlite3 API used by src/database/*.js,
// backed by Node's built-in node:sqlite. Used ONLY for local testing in this sandbox,
// since better-sqlite3's native binary can't be compiled here (no network access to
// fetch prebuilt binaries or Node headers). The real app uses the real better-sqlite3.
const { DatabaseSync } = require('node:sqlite');

class StatementWrapper {
  constructor(stmt) {
    this.stmt = stmt;
  }
  // better-sqlite3 supports both positional args and a single object of named params.
  // node:sqlite's StatementSync.run/get/all accept named params as an object with ':'/'@'/'$' prefixes
  // OR positional args. We normalize plain-object named params (used via @name in our SQL) directly,
  // since node:sqlite accepts {name: value} for params named @name/:name/$name.
  run(...args) {
    const result = this.stmt.run(...args);
    return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
  }
  get(...args) {
    return this.stmt.get(...args);
  }
  all(...args) {
    return this.stmt.all(...args);
  }
}

class DatabaseWrapper {
  constructor(path) {
    this.db = new DatabaseSync(path);
  }
  pragma(str) {
    // node:sqlite doesn't have a .pragma() helper; execute directly.
    this.db.exec(`PRAGMA ${str}`);
  }
  exec(sql) {
    this.db.exec(sql);
  }
  prepare(sql) {
    return new StatementWrapper(this.db.prepare(sql));
  }
  transaction(fn) {
    return (...args) => {
      this.db.exec('BEGIN');
      try {
        const result = fn(...args);
        this.db.exec('COMMIT');
        return result;
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
    };
  }
  close() {
    this.db.close();
  }
}

module.exports = DatabaseWrapper;
