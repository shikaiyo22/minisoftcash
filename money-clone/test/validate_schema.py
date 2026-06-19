import sqlite3
import sys

conn = sqlite3.connect(':memory:')
conn.execute('PRAGMA foreign_keys = ON')

with open('/home/claude/money-clone/src/database/schema.sql') as f:
    schema = f.read()

try:
    conn.executescript(schema)
    print("SCHEMA: OK - all tables/indexes created without error")
except Exception as e:
    print(f"SCHEMA ERROR: {e}")
    sys.exit(1)

# List tables created
cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in cur.fetchall()]
print("Tables:", tables)

cur = conn.execute("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")
indexes = [r[0] for r in cur.fetchall()]
print("Indexes:", indexes)

conn.close()
