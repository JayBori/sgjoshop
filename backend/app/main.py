import os, sqlite3

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
        price REAL
      );
    """)

    # seed (한번만)
    cur.execute("SELECT COUNT(*) FROM products;")
    if cur.fetchone()[0] == 0:
        cur.executemany(
          "INSERT INTO products(sku,name,description,price) VALUES (?,?,?,?)",
          [
            ("SKU-001","Apple","Fresh apple",1.2),
            ("SKU-002","Banana","Sweet banana",0.8),
          ]
        )
    conn.commit()
    conn.close()
