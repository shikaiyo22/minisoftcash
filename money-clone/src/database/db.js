const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { app } = require('electron');
const defaultCategories = require('./default-categories');

let db = null;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  return path.join(userDataPath, 'money-manager.sqlite3');
}

function seedDefaultCategories() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM categories').get();
  if (existing.c > 0) return;

  const insertCat = db.prepare(
    'INSERT INTO categories (name, type, parent_id, is_system) VALUES (?, ?, ?, 1)'
  );

  const insertMany = db.transaction((cats) => {
    for (const cat of cats) {
      const result = insertCat.run(cat.name, cat.type, null);
      const parentId = result.lastInsertRowid;
      if (cat.children && cat.children.length) {
        for (const childName of cat.children) {
          insertCat.run(childName, cat.type, parentId);
        }
      }
    }
  });

  insertMany(defaultCategories);
}

function initDatabase() {
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  seedDefaultCategories();

  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { initDatabase, getDb, closeDatabase, getDbPath };
