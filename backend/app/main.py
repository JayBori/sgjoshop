import os
import sqlite3
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from starlette.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"]
    ,allow_headers=["*"]
)

DB_PATH = os.getenv("DB_PATH", "/data/shop.db")


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
      CREATE TABLE IF NOT EXISTS products(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT,
        name TEXT,
        description TEXT,
        price REAL,
        image_url TEXT,
        stock INTEGER DEFAULT 100
      );
    """)

    # Cart table (anonymous cart via cart_id string)
    cur.execute("""
      CREATE TABLE IF NOT EXISTS carts(
        cart_id TEXT,
        product_id INTEGER,
        qty INTEGER,
        PRIMARY KEY(cart_id, product_id)
      );
    """)

    # Orders tables
    cur.execute("""
      CREATE TABLE IF NOT EXISTS orders(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cart_id TEXT,
        total REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    """)
    cur.execute("""
      CREATE TABLE IF NOT EXISTS order_items(
        order_id INTEGER,
        product_id INTEGER,
        qty INTEGER,
        price REAL
      );
    """)

    # Ensure new columns exist for older DBs
    cur.execute("PRAGMA table_info(products);")
    cols = {row[1] for row in cur.fetchall()}
    if "image_url" not in cols:
        cur.execute("ALTER TABLE products ADD COLUMN image_url TEXT;")
    if "stock" not in cols:
        cur.execute("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 100;")

    # seed (한번만)
    cur.execute("SELECT COUNT(*) FROM products;")
    if cur.fetchone()[0] == 0:
        seed_rows = [
            ("SKU-001", "Classic Tee", "Soft cotton T-shirt in various colors.", 19.99, "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600", 200),
            ("SKU-002", "Denim Jacket", "Timeless denim jacket with a modern fit.", 59.0, "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600", 80),
            ("SKU-003", "Running Shoes", "Lightweight sneakers for everyday comfort.", 89.0, "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600", 120),
            ("SKU-004", "Wireless Earbuds", "True wireless earbuds with noise isolation.", 49.0, "https://images.unsplash.com/photo-1585386959984-a41552231658?w=600", 150),
            ("SKU-005", "Backpack", "Durable backpack with 15\" laptop sleeve.", 39.0, "https://images.unsplash.com/photo-1514477917009-389c76a86b68?w=600", 60),
            ("SKU-006", "Water Bottle", "Insulated stainless steel, 600ml.", 15.0, "https://images.unsplash.com/photo-1526404954014-2fa806b5aa47?w=600", 300),
        ]
        cur.executemany(
            "INSERT INTO products(sku,name,description,price,image_url,stock) VALUES (?,?,?,?,?,?)",
            seed_rows,
        )

    conn.commit()
    conn.close()


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/health")
def health():
    return {"ok": True, "db_path": DB_PATH}


@app.get("/products")
def products():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, sku, name, description, price, image_url, stock FROM products ORDER BY id;")
    rows = cur.fetchall()
    conn.close()

    return [
        {
            "id": r[0],
            "sku": r[1],
            "name": r[2],
            "description": r[3],
            "price": r[4],
            "image_url": r[5],
            "stock": r[6],
        }
        for r in rows
    ]


@app.post("/init")
def reseed():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("DELETE FROM products;")
    seed_rows = [
        ("SKU-001", "Classic Tee", "Soft cotton T-shirt in various colors.", 19.99, "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600", 200),
        ("SKU-002", "Denim Jacket", "Timeless denim jacket with a modern fit.", 59.0, "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600", 80),
        ("SKU-003", "Running Shoes", "Lightweight sneakers for everyday comfort.", 89.0, "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=600", 120),
        ("SKU-004", "Wireless Earbuds", "True wireless earbuds with noise isolation.", 49.0, "https://images.unsplash.com/photo-1585386959984-a41552231658?w=600", 150),
        ("SKU-005", "Backpack", "Durable backpack with 15\" laptop sleeve.", 39.0, "https://images.unsplash.com/photo-1514477917009-389c76a86b68?w=600", 60),
        ("SKU-006", "Water Bottle", "Insulated stainless steel, 600ml.", 15.0, "https://images.unsplash.com/photo-1526404954014-2fa806b5aa47?w=600", 300),
    ]
    cur.executemany(
        "INSERT INTO products(sku,name,description,price,image_url,stock) VALUES (?,?,?,?,?,?)",
        seed_rows,
    )
    conn.commit()
    conn.close()
    return {"ok": True, "seeded": len(seed_rows)}


@app.get("/cart")
def get_cart(cart_id: str = Query(...)):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT c.product_id, c.qty, p.name, p.price, p.image_url
        FROM carts c
        JOIN products p ON p.id = c.product_id
        WHERE c.cart_id = ?
        ORDER BY c.product_id
        """,
        (cart_id,),
    )
    rows = cur.fetchall()
    conn.close()
    items = [
        {
            "product_id": r[0],
            "qty": r[1],
            "name": r[2],
            "price": r[3],
            "image_url": r[4],
            "line_total": r[1] * r[3],
        }
        for r in rows
    ]
    total = sum(i[1] * i[3] for i in rows)
    count = sum(i[1] for i in rows)
    return {"cart_id": cart_id, "count": count, "total": total, "items": items}


@app.post("/cart/items")
def add_cart_item(product_id: int, qty: int = 1, cart_id: str = Query(...)):
    if qty <= 0:
        raise HTTPException(400, "qty must be positive")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    # ensure product exists
    cur.execute("SELECT id, stock FROM products WHERE id = ?", (product_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "product not found")
    # upsert
    cur.execute(
        "SELECT qty FROM carts WHERE cart_id=? AND product_id=?",
        (cart_id, product_id),
    )
    existing = cur.fetchone()
    if existing:
        cur.execute(
            "UPDATE carts SET qty = qty + ? WHERE cart_id=? AND product_id=?",
            (qty, cart_id, product_id),
        )
    else:
        cur.execute(
            "INSERT INTO carts(cart_id, product_id, qty) VALUES (?,?,?)",
            (cart_id, product_id, qty),
        )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/cart/items/{product_id}")
def remove_cart_item(product_id: int, cart_id: str = Query(...)):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM carts WHERE cart_id=? AND product_id=?",
        (cart_id, product_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/orders")
def create_order(cart_id: str = Query(...)):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    # load cart
    cur.execute(
        "SELECT product_id, qty FROM carts WHERE cart_id=?",
        (cart_id,),
    )
    items = cur.fetchall()
    if not items:
        conn.close()
        raise HTTPException(400, "cart is empty")

    # check stock and compute total
    total = 0.0
    for pid, q in items:
        cur.execute("SELECT price, stock FROM products WHERE id=?", (pid,))
        row = cur.fetchone()
        if not row:
            conn.close()
            raise HTTPException(400, f"invalid product {pid}")
        price, stock = row
        if q > stock:
            conn.close()
            raise HTTPException(400, f"insufficient stock for product {pid}")
        total += price * q

    # create order and decrease stock
    cur.execute("INSERT INTO orders(cart_id, total) VALUES (?,?)", (cart_id, total))
    order_id = cur.lastrowid
    for pid, q in items:
        cur.execute("SELECT price FROM products WHERE id=?", (pid,))
        price = cur.fetchone()[0]
        cur.execute(
            "INSERT INTO order_items(order_id, product_id, qty, price) VALUES (?,?,?,?)",
            (order_id, pid, q, price),
        )
        cur.execute("UPDATE products SET stock = stock - ? WHERE id=?", (q, pid))

    # clear cart
    cur.execute("DELETE FROM carts WHERE cart_id=?", (cart_id,))
    conn.commit()
    conn.close()
    return {"ok": True, "order_id": order_id, "total": total}
