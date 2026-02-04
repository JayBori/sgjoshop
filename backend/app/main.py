import os
import sqlite3
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
from passlib.context import CryptContext

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.getenv("DB_PATH", "/data/shop.db")
IMAGE_BASE = os.getenv("IMAGE_BASE", "")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/data/uploads")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/images", StaticFiles(directory=UPLOAD_DIR), name="images")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS products(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sku TEXT,
          name TEXT,
          description TEXT,
          price REAL,
          image_url TEXT,
          stock INTEGER DEFAULT 100
        );
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS carts(
          cart_id TEXT,
          product_id INTEGER,
          qty INTEGER,
          PRIMARY KEY(cart_id, product_id)
        );
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS orders(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cart_id TEXT,
          total REAL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS order_items(
          order_id INTEGER,
          product_id INTEGER,
          qty INTEGER,
          price REAL
        );
        """
    )

    # users table
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          password_hash TEXT,
          is_admin INTEGER DEFAULT 0,
          must_change_password INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    # ensure columns exist
    cur.execute("PRAGMA table_info(products);")
    cols = {row[1] for row in cur.fetchall()}
    if "image_url" not in cols:
        cur.execute("ALTER TABLE products ADD COLUMN image_url TEXT;")
    if "stock" not in cols:
        cur.execute("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 100;")

    # seed admin user
    cur.execute("SELECT id FROM users WHERE username=?", ("admin",))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO users(username, password_hash, is_admin, must_change_password) VALUES (?,?,1,1)",
            ("admin", hash_password(os.getenv("ADMIN_INITIAL_PASSWORD", "eogksalsrnr1!"))),
        )

    # seed minimal products if empty
    cur.execute("SELECT COUNT(*) FROM products;")
    if cur.fetchone()[0] == 0:
        seed_rows = [
            ("SKU-001", "Sample Tee", "Basic tee", 19.0, "", 200),
            ("SKU-002", "Sample Hoodie", "Basic hoodie", 45.0, "", 120),
        ]
        cur.executemany(
            "INSERT INTO products(sku, name, description, price, image_url, stock) VALUES (?,?,?,?,?,?)",
            seed_rows,
        )

    conn.commit()
    conn.close()


init_db()


# Auth helpers
from fastapi.security import OAuth2PasswordBearer
from fastapi import Header

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(401, "invalid token")
    except JWTError:
        raise HTTPException(401, "invalid token")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, username, is_admin, must_change_password FROM users WHERE id=?", (user_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        raise HTTPException(401, "user not found")
    return {"id": row[0], "username": row[1], "is_admin": bool(row[2]), "must_change_password": bool(row[3])}


def require_admin(user=Depends(get_current_user)):
    if not user["is_admin"]:
        raise HTTPException(403, "admin required")
    return user


# Auth endpoints
@app.post("/auth/signup")
def signup(username: str = Form(...), password: str = Form(...)):
    if len(username) < 3 or len(password) < 6:
        raise HTTPException(400, "username/password too short")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users(username, password_hash, is_admin, must_change_password) VALUES (?,?,0,0)",
            (username, hash_password(password)),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(400, "username already exists")
    conn.close()
    return {"ok": True}


@app.post("/auth/login")
def login(username: str = Form(...), password: str = Form(...)):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, password_hash, must_change_password FROM users WHERE username=?", (username,))
    row = cur.fetchone()
    conn.close()
    if not row or not verify_password(password, row[1]):
        raise HTTPException(401, "invalid credentials")
    token = create_access_token({"sub": row[0]})
    return {"access_token": token, "token_type": "bearer", "must_change_password": bool(row[2])}


@app.post("/auth/change-password")
def change_password(new_password: str = Form(...), user=Depends(get_current_user)):
    if len(new_password) < 6:
        raise HTTPException(400, "password too short")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?",
        (hash_password(new_password), user["id"]),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/admin/users")
def list_users(_: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, username, is_admin, must_change_password, created_at FROM users ORDER BY id DESC")
    rows = cur.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "username": r[1],
            "is_admin": bool(r[2]),
            "must_change_password": bool(r[3]),
            "created_at": r[4],
        }
        for r in rows
    ]


# Public endpoints
@app.get("/health")
def health():
    return {"ok": True}


@app.get("/products")
def list_products(q: Optional[str] = None):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    if q:
        cur.execute(
            "SELECT id, sku, name, description, price, image_url, stock FROM products WHERE name LIKE ? ORDER BY id DESC",
            (f"%{q}%",),
        )
    else:
        cur.execute("SELECT id, sku, name, description, price, image_url, stock FROM products ORDER BY id DESC")
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


# Cart / Orders (existing minimal)
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
    cur.execute("SELECT id, stock FROM products WHERE id = ?", (product_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "product not found")
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
    cur.execute("SELECT product_id, qty FROM carts WHERE cart_id=?", (cart_id,))
    items = cur.fetchall()
    if not items:
        conn.close()
        raise HTTPException(400, "cart is empty")

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

    cur.execute("DELETE FROM carts WHERE cart_id=?", (cart_id,))
    conn.commit()
    conn.close()
    return {"ok": True, "order_id": order_id, "total": total}


# Admin product CRUD with image upload
@app.get("/admin/products")

def admin_list_products(_: dict = Depends(require_admin)):
    return list_products()


@app.post("/admin/products")

def admin_create_product(
    sku: str = Form(...),
    name: str = Form(...),
    description: str = Form(""),
    price: float = Form(...),
    stock: int = Form(0),
    image: Optional[UploadFile] = File(None),
    _: dict = Depends(require_admin),
):
    image_url = ""
    if image is not None:
        ext = os.path.splitext(image.filename)[1]
        fname = f"{uuid.uuid4().hex}{ext}"
        dest = os.path.join(UPLOAD_DIR, fname)
        with open(dest, "wb") as f:
            f.write(image.file.read())
        image_url = f"/images/{fname}"
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO products(sku, name, description, price, image_url, stock) VALUES (?,?,?,?,?,?)",
        (sku, name, description, price, image_url, stock),
    )
    conn.commit()
    pid = cur.lastrowid
    conn.close()
    return {"id": pid}


@app.put("/admin/products/{pid}")

def admin_update_product(
    pid: int,
    sku: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    price: Optional[float] = Form(None),
    stock: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    _: dict = Depends(require_admin),
):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT image_url FROM products WHERE id=?", (pid,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(404, "product not found")
    sets = []
    vals = []
    if sku is not None:
        sets.append("sku=?"); vals.append(sku)
    if name is not None:
        sets.append("name=?"); vals.append(name)
    if description is not None:
        sets.append("description=?"); vals.append(description)
    if price is not None:
        sets.append("price=?"); vals.append(price)
    if stock is not None:
        sets.append("stock=?"); vals.append(stock)
    if image is not None:
        ext = os.path.splitext(image.filename)[1]
        fname = f"{uuid.uuid4().hex}{ext}"
        dest = os.path.join(UPLOAD_DIR, fname)
        with open(dest, "wb") as f:
            f.write(image.file.read())
        sets.append("image_url=?"); vals.append(f"/images/{fname}")
    if not sets:
        conn.close(); return {"ok": True}
    vals.append(pid)
    cur.execute(f"UPDATE products SET {', '.join(sets)} WHERE id=?", tuple(vals))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/admin/products/{pid}")

def admin_delete_product(pid: int, _: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("DELETE FROM products WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.post("/init")
def init_seed():
    # reseed minimal products only if empty
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM products")
    count = cur.fetchone()[0]
    if count == 0:
        seed_rows = [
            ("SKU-001", "Sample Tee", "Basic tee", 19.0, "", 200),
            ("SKU-002", "Sample Hoodie", "Basic hoodie", 45.0, "", 120),
        ]
        cur.executemany(
            "INSERT INTO products(sku, name, description, price, image_url, stock) VALUES (?,?,?,?,?,?)",
            seed_rows,
        )
        conn.commit()
        conn.close()
        return {"ok": True, "seeded": len(seed_rows)}
    conn.close()
    return {"ok": True, "seeded": 0}

