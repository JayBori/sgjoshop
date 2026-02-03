import os
import psycopg2
from fastapi import FastAPI

app = FastAPI(title="SGJO Shop API", version="0.1.0")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "shopdb")
DB_USER = os.getenv("DB_USER", "shopuser")
DB_PASSWORD = os.getenv("DB_PASSWORD", "shoppass")

def get_conn():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD
    )

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/init")
def init_db():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price NUMERIC(10,2) NOT NULL
    );
    """)

    cur.execute("SELECT COUNT(*) FROM products;")
    count = cur.fetchone()[0]

    if count == 0:
        cur.execute("""
        INSERT INTO products (sku, name, description, price) VALUES
        ('SKU-TSHIRT-001', 'Basic T-Shirt', 'Soft cotton', 19.99),
        ('SKU-MUG-001', 'Coffee Mug', 'Ceramic mug', 9.99),
        ('SKU-HOODIE-001', 'Hoodie', 'Warm hoodie', 39.99);
        """)

    conn.commit()
    cur.close()
    conn.close()
    return {"initialized": True, "count": count}

@app.get("/products")
def products():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, sku, name, description, price FROM products ORDER BY id;")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return [
        {"id": r[0], "sku": r[1], "name": r[2], "description": r[3], "price": float(r[4])}
        for r in rows
    ]
