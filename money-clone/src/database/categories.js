const { getDb } = require('./db');

function listCategories() {
  const db = getDb();
  return db.prepare('SELECT * FROM categories ORDER BY type ASC, name ASC').all();
}

function listCategoriesTree() {
  const db = getDb();
  const all = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  const byId = new Map(all.map(c => [c.id, { ...c, children: [] }]));
  const roots = [];
  for (const cat of byId.values()) {
    if (cat.parent_id && byId.has(cat.parent_id)) {
      byId.get(cat.parent_id).children.push(cat);
    } else {
      roots.push(cat);
    }
  }
  return roots;
}

function createCategory({ name, type, parent_id }) {
  const db = getDb();
  if (!name || !name.trim()) throw new Error('Category name is required');
  const result = db.prepare(
    'INSERT INTO categories (name, type, parent_id, is_system) VALUES (?, ?, ?, 0)'
  ).run(name.trim(), type, parent_id || null);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
}

function updateCategory(id, { name, parent_id }) {
  const db = getDb();
  db.prepare('UPDATE categories SET name = ?, parent_id = ? WHERE id = ?').run(name, parent_id || null, id);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

function deleteCategory(id) {
  const db = getDb();
  const inUse = db.prepare('SELECT COUNT(*) AS c FROM transactions WHERE category_id = ?').get(id);
  const inUseSplits = db.prepare('SELECT COUNT(*) AS c FROM transaction_splits WHERE category_id = ?').get(id);
  if (inUse.c > 0 || inUseSplits.c > 0) {
    throw new Error('Cannot delete category that has transactions. Reassign them first.');
  }
  const hasChildren = db.prepare('SELECT COUNT(*) AS c FROM categories WHERE parent_id = ?').get(id);
  if (hasChildren.c > 0) {
    throw new Error('Cannot delete category with subcategories. Delete or move them first.');
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return true;
}

function listPayees() {
  const db = getDb();
  return db.prepare('SELECT * FROM payees ORDER BY name ASC').all();
}

module.exports = { listCategories, listCategoriesTree, createCategory, updateCategory, deleteCategory, listPayees };
