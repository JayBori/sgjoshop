import os
import sqlite3
from fastapi import FastAPI

app = FastAPI(title="SGJO Shop API", version="0.1.0")

DB_PATH = os.getenv("DB_PATH", "/data/shop.db")

def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

@app.get("/health")
def health():
    return {"ok": True, "db_path": DB_PATH}

@app.post("/init")
def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    c = conn()
    cur = c.cursor()
    cur.execute("""
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price REAL NOT NULL
      );
    """)
    cur.execute("SELECT COUNT(*) as cnt FROM products;")
    cnt = cur.fetchone()["cnt"]

    if cnt == 0:
        cur.executemany(
            "INSERT INTO products (sku, name, description, price) VALUES (?, ?, ?, ?)",
            [
                ("SKU-TSHIRT-001", "Basic T-Shirt", "Soft cotton", 19.99),
                ("SKU-MUG-001", "Coffee Mug", "Ceramic mug", 9.99),
                ("SKU-HOODIE-001", "Hoodie", "Warm hoodie", 39.99),
            ],
        )

    c.commit()
    c.close()
    return {"initialized": True}

@app.get("/products")
def products():
    c = conn()
    cur = c.cursor()
    cur.execute("SELECT id, sku, name, description, price FROM products ORDER BY id;")
    rows = [dict(r) for r in cur.fetchall()]
    c.close()
    return rows
