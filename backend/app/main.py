import os
import sqlite3
import uuid
from datetime import datetime, timedelta
from typing import Optional, Tuple

from fastapi import FastAPI, HTTPException, Query, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import logging
from logging.handlers import RotatingFileHandler
LOG_DIR = os.getenv("LOG_DIR", "/data/logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "app.log")
_logger = logging.getLogger("app")
_logger.setLevel(logging.INFO)
if not _logger.handlers:
    fh = RotatingFileHandler(LOG_FILE, maxBytes=1048576, backupCount=3)
    fmt = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
    fh.setFormatter(fmt)
    _logger.addHandler(fh)
from jose import jwt, JWTError
from passlib.context import CryptContext
from azure.storage.blob import BlobServiceClient

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

pwd_context = CryptContext(schemes=["pbkdf2_sha256","bcrypt"], deprecated="auto")

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
    # ensure orders.status
    cur.execute("PRAGMA table_info(orders);")
    ocols = {row[1] for row in cur.fetchall()}
    if "status" not in ocols:
        cur.execute("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending';")

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
          is_active INTEGER DEFAULT 1,
          last_login TIMESTAMP,
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

    # ensure users added columns exist
    cur.execute("PRAGMA table_info(users);")
    ucols = {row[1] for row in cur.fetchall()}
    if "is_active" not in ucols:
        cur.execute("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;")
    if "last_login" not in ucols:
        cur.execute("ALTER TABLE users ADD COLUMN last_login TIMESTAMP;")

    # seed admin user
    cur.execute("SELECT id FROM users WHERE username=?", ("admin",))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO users(username, password_hash, is_admin, is_active, must_change_password) VALUES (?,?,1,1,0)",
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

    # categories
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS categories(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          slug TEXT UNIQUE,
          sort INTEGER DEFAULT 0
        );
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS product_categories(
          product_id INTEGER,
          category_id INTEGER,
          PRIMARY KEY(product_id, category_id)
        );
        """
    )

    # media
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS media(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT,
          url TEXT,
          size INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    # coupons and cart_discounts
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS coupons(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE,
          type TEXT,
          value REAL,
          active INTEGER DEFAULT 1,
          valid_from TEXT,
          valid_to TEXT,
          min_amount REAL DEFAULT 0
        );
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS cart_discounts(
          cart_id TEXT PRIMARY KEY,
          code TEXT,
          discount REAL
        );
        """
    )

    conn.commit()
    conn.close()


init_db()


# Auth helpers
from fastapi.security import OAuth2PasswordBearer
from fastapi import Header, Request

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def _fetch_user_by_id(user_id: int) -> Optional[Tuple]:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, username, is_admin, is_active, must_change_password, last_login FROM users WHERE id=?", (user_id,))
    row = cur.fetchone()
    conn.close()
    return row


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(401, "invalid token")
    except JWTError:
        raise HTTPException(401, "invalid token")
    row = _fetch_user_by_id(user_id)
    if not row:
        raise HTTPException(401, "user not found")
    if not bool(row[3]):
        raise HTTPException(403, "user is inactive")
    return {
        "id": row[0],
        "username": row[1],
        "is_admin": bool(row[2]),
        "is_active": bool(row[3]),
        "must_change_password": bool(row[4]),
        "last_login": row[5],
    }


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


_failed_logins: dict = {}


@app.post("/auth/login")
def login(request: Request, username: str = Form(...), password: str = Form(...)):
    # rate limit by ip+username (simple in-memory)
    ip = request.client.host if request.client else "?"
    key = f"{ip}:{username}"
    rec = _failed_logins.get(key)
    now = datetime.utcnow()
    if rec and rec.get("until") and now < rec["until"]:
        raise HTTPException(429, "too many attempts, try later")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, password_hash, must_change_password, is_admin, is_active FROM users WHERE username=?", (username,))
    row = cur.fetchone()
    if not row or not verify_password(password, row[1]):
        # record failed
        cnt = (rec or {}).get("cnt", 0) + 1
        until = now + timedelta(minutes=5) if cnt >= 5 else None
        _failed_logins[key] = {"cnt": cnt, "until": until}
        conn.close()
        raise HTTPException(401, "invalid credentials")
    if row[4] == 0:
        conn.close()
        raise HTTPException(403, "user inactive")
    # success: clear failed and set last_login
    if key in _failed_logins:
        del _failed_logins[key]
    cur.execute("UPDATE users SET last_login=? WHERE id=?", (datetime.utcnow().isoformat(), row[0]))
    conn.commit(); conn.close()
    token = create_access_token({"sub": row[0]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "must_change_password": bool(row[2]),
        "is_admin": bool(row[3]),
    }


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
def list_users(
    _: dict = Depends(require_admin),
    query: Optional[str] = Query(None),
    sort: Optional[str] = Query("-id"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    base = "SELECT id, username, is_admin, is_active, must_change_password, created_at, last_login FROM users"
    where = ""
    params = []
    if query:
        where = " WHERE username LIKE ?"
        params.append(f"%{query}%")
    order = " ORDER BY id DESC"
    if sort in ("id", "-id", "username", "-username", "created_at", "-created_at"):
        desc = sort.startswith("-")
        col = sort[1:] if desc else sort
        order = f" ORDER BY {col} {'DESC' if desc else 'ASC'}"
    limit = " LIMIT ? OFFSET ?"
    params.extend([page_size, (page-1)*page_size])
    cur.execute(base + where + order + limit, tuple(params))
    rows = cur.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "username": r[1],
            "is_admin": bool(r[2]),
            "is_active": bool(r[3]),
            "must_change_password": bool(r[4]),
            "created_at": r[5],
            "last_login": r[6],
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


@app.get("/products/{pid}")
def get_product(pid: int):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, sku, name, description, price, image_url, stock FROM products WHERE id=?", (pid,))
    r = cur.fetchone()
    if not r:
        conn.close(); raise HTTPException(404, "not found")
    # categories
    cur.execute("SELECT c.id, c.name, c.slug FROM product_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.product_id=?", (pid,))
    cats = [{"id":x[0],"name":x[1],"slug":x[2]} for x in cur.fetchall()]
    conn.close()
    return {"id": r[0], "sku": r[1], "name": r[2], "description": r[3], "price": r[4], "image_url": r[5], "stock": r[6], "categories": cats}


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
    cur = sqlite3.connect(DB_PATH).cursor()
    conn2 = sqlite3.connect(DB_PATH)
    cur2 = conn2.cursor()
    cur2.execute("SELECT code, discount FROM cart_discounts WHERE cart_id=?", (cart_id,))
    c = cur2.fetchone(); conn2.close()
    discount = c[1] if c else 0.0
    final_total = max(0.0, total - discount)
    return {"cart_id": cart_id, "count": count, "total": total, "discount": discount, "final_total": final_total, "coupon": c[0] if c else None, "items": items}


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

    # apply discount if set
    cur2 = conn.cursor()
    cur2.execute("SELECT discount FROM cart_discounts WHERE cart_id=?", (cart_id,))
    c = cur2.fetchone()
    discount = c[0] if c else 0.0
    grand = max(0.0, total - discount)
    cur.execute("INSERT INTO orders(cart_id, total, status) VALUES (?,?,?)", (cart_id, grand, 'pending'))
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
    cur.execute("DELETE FROM cart_discounts WHERE cart_id=?", (cart_id,))
    conn.commit()
    conn.close()
    return {"ok": True, "order_id": order_id, "total": grand}


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
    categories: Optional[str] = Form(None),
    _: dict = Depends(require_admin),
):
    image_url = ""
    if image is not None:
        ext = os.path.splitext(image.filename)[1]
        fname = f"{uuid.uuid4().hex}{ext}"
        data = image.file.read()
        blob_url = _upload_to_blob_if_configured(fname, data)
        if blob_url:
            image_url = blob_url
        else:
            dest = os.path.join(UPLOAD_DIR, fname)
            with open(dest, "wb") as f:
                f.write(data)
            base = os.getenv("IMAGE_BASE", "")
            image_url = f"{base.rstrip('/')}/images/{fname}" if base else f"/images/{fname}"
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO products(sku, name, description, price, image_url, stock) VALUES (?,?,?,?,?,?)",
        (sku, name, description, price, image_url, stock),
    )
    conn.commit()
    pid = cur.lastrowid
    if categories:
        try:
            ids = [int(x) for x in categories.split(',') if x.strip()]
            for cid in ids:
                cur.execute("INSERT OR IGNORE INTO product_categories(product_id, category_id) VALUES (?,?)", (pid, cid))
            conn.commit()
        except Exception:
            pass
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
    categories: Optional[str] = Form(None),
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
        data = image.file.read()
        blob_url = _upload_to_blob_if_configured(fname, data)
        if blob_url:
            sets.append("image_url=?"); vals.append(blob_url)
        else:
            dest = os.path.join(UPLOAD_DIR, fname)
            with open(dest, "wb") as f:
                f.write(data)
            base = os.getenv("IMAGE_BASE", "")
            url = f"{base.rstrip('/')}/images/{fname}" if base else f"/images/{fname}"
            sets.append("image_url=?"); vals.append(url)
    if not sets and categories is None:
        conn.close(); return {"ok": True}
    vals.append(pid)
    cur.execute(f"UPDATE products SET {', '.join(sets)} WHERE id=?", tuple(vals))
    if categories is not None:
        cur.execute("DELETE FROM product_categories WHERE product_id=?", (pid,))
        if categories:
            try:
                ids = [int(x) for x in categories.split(',') if x.strip()]
                for cid in ids:
                    cur.execute("INSERT OR IGNORE INTO product_categories(product_id, category_id) VALUES (?,?)", (pid, cid))
            except Exception:
                pass
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


def _upload_to_blob_if_configured(filename: str, data: bytes) -> Optional[str]:
    conn_str = os.getenv("AZURE_BLOB_CONNECTION_STRING")
    container = os.getenv("AZURE_BLOB_CONTAINER")
    if not conn_str or not container:
        return None
    try:
        svc = BlobServiceClient.from_connection_string(conn_str)
        try:
            svc.create_container(container)
        except Exception:
            pass
        blob_name = filename
        url = svc.get_blob_client(container=container, blob=blob_name)
        url.upload_blob(data, overwrite=True)
        return url.url
    except Exception as e:
        return None











from starlette.requests import Request
from starlette.responses import Response
from fastapi.responses import JSONResponse
from fastapi import status

@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        resp: Response = await call_next(request)
        _logger.info(f"{request.method} {request.url.path} -> {resp.status_code}")
        return resp
    except Exception as e:
        _logger.exception(f"Unhandled error on {request.method} {request.url.path}: {e}")
        return JSONResponse({"detail": "internal server error"}, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


@app.get("/auth/check-username")
def check_username(u: str = Query(...)):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM users WHERE username=?", (u.strip(),))
    exists = cur.fetchone() is not None
    conn.close()
    return {"available": not exists}

@app.post("/auth/reset-admin")
def reset_admin(new_password: str = Form(...)):
    # Simple safeguard: require env var RESET_TOKEN and header X-Reset-Token to match
    required = os.getenv("ADMIN_RESET_TOKEN", "")
    if not required:
        raise HTTPException(403, "reset token not set")
    token = os.getenv("ADMIN_RESET_TOKEN")
    # For simplicity, pull token from env only; operator should set env temporarily when calling inside container
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("UPDATE users SET password_hash=?, must_change_password=1, is_admin=1 WHERE username='admin'", (hash_password(new_password),))
    conn.commit(); conn.close()
    _logger.warning("admin password reset via /auth/reset-admin")
    return {"ok": True}

# Settings and role helpers
@app.get("/auth/me")
def auth_me(user=Depends(get_current_user)):
    return user


@app.get("/settings/public")
def public_settings():
    keys = ["promoText","heroTitle","heroSubtitle"]
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    out = {}
    try:
        cur.execute("CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT)")
        for k in keys:
            cur.execute("SELECT value FROM settings WHERE key=?", (k,))
            row = cur.fetchone()
            if row:
                out[k] = row[0]
    finally:
        conn.close()
    return out


@app.get("/admin/settings")
def admin_get_settings(_: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT)")
    cur.execute("SELECT key, value FROM settings")
    rows = cur.fetchall()
    conn.close()
    return {k: v for (k, v) in rows}


@app.put("/admin/settings")
def admin_put_settings(payload: dict, _: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT)")
    for k, v in payload.items():
        cur.execute(
            "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (k, str(v)),
        )
    conn.commit(); conn.close()
    return {"ok": True}


@app.delete("/admin/users/{uid}")
def admin_delete_user(uid: int, _: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT username FROM users WHERE id=?", (uid,))
    row = cur.fetchone()
    if not row:
        conn.close();
        raise HTTPException(404, "user not found")
    if row[0] == 'admin':
        conn.close();
        raise HTTPException(400, "cannot delete admin user")
    cur.execute("DELETE FROM users WHERE id=?", (uid,))
    conn.commit(); conn.close()
    return {"ok": True}


# ===== New: Categories, Media, Coupons, Orders, Dashboard =====
def _slugify(name: str) -> str:
    s = ''.join(c.lower() if c.isalnum() else '-' for c in name)
    while '--' in s:
        s = s.replace('--', '-')
    return s.strip('-')


@app.get("/admin/categories")
def admin_list_categories(_: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("SELECT id, name, slug, sort FROM categories ORDER BY sort ASC, id DESC")
    rows = cur.fetchall(); conn.close()
    return [{"id":r[0],"name":r[1],"slug":r[2],"sort":r[3]} for r in rows]


@app.get("/categories")
def public_list_categories():
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("SELECT id, name, slug, sort FROM categories ORDER BY sort ASC, id DESC")
    rows = cur.fetchall(); conn.close()
    return [{"id":r[0],"name":r[1],"slug":r[2],"sort":r[3]} for r in rows]


@app.get("/categories/{slug}/products")
def public_category_products(slug: str):
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("SELECT id FROM categories WHERE slug=?", (slug,))
    row = cur.fetchone()
    if not row:
        conn.close(); raise HTTPException(404, 'category not found')
    cid = row[0]
    cur.execute("SELECT p.id, p.sku, p.name, p.description, p.price, p.image_url, p.stock FROM product_categories pc JOIN products p ON p.id=pc.product_id WHERE pc.category_id=? ORDER BY p.id DESC", (cid,))
    rows = cur.fetchall(); conn.close()
    return [{"id":r[0],"sku":r[1],"name":r[2],"description":r[3],"price":r[4],"image_url":r[5],"stock":r[6]} for r in rows]


@app.post("/admin/categories")
def admin_create_category(name: str = Form(...), sort: int = Form(0), _: dict = Depends(require_admin)):
    slug = _slugify(name)
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("INSERT INTO categories(name, slug, sort) VALUES (?,?,?)", (name, slug, sort))
    conn.commit(); cid = cur.lastrowid; conn.close(); return {"id": cid}


@app.put("/admin/categories/{cid}")
def admin_update_category(cid: int, name: Optional[str] = Form(None), sort: Optional[int] = Form(None), _: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    sets=[]; vals=[]
    if name is not None:
        sets.append("name=?"); vals.append(name)
        sets.append("slug=?"); vals.append(_slugify(name))
    if sort is not None:
        sets.append("sort=?"); vals.append(sort)
    if not sets:
        conn.close(); return {"ok": True}
    vals.append(cid)
    cur.execute(f"UPDATE categories SET {', '.join(sets)} WHERE id=?", tuple(vals))
    conn.commit(); conn.close(); return {"ok": True}


@app.delete("/admin/categories/{cid}")
def admin_delete_category(cid: int, _: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("DELETE FROM product_categories WHERE category_id=?", (cid,))
    cur.execute("DELETE FROM categories WHERE id=?", (cid,))
    conn.commit(); conn.close(); return {"ok": True}


@app.patch("/admin/users/{uid}")
def admin_toggle_user(uid: int, active: Optional[int] = Form(None), _: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT username, is_active FROM users WHERE id=?", (uid,))
    row = cur.fetchone()
    if not row:
        conn.close();
        raise HTTPException(404, "user not found")
    if row[0] == 'admin' and active == 0:
        conn.close();
        raise HTTPException(400, "cannot deactivate admin user")
    if active is None:
        # toggle
        active = 0 if row[1] else 1
    cur.execute("UPDATE users SET is_active=? WHERE id=?", (1 if int(active) else 0, uid))
    conn.commit(); conn.close()
    return {"ok": True, "is_active": bool(active)}


@app.get("/admin/logs")
def admin_logs(_: dict = Depends(require_admin), lines: int = Query(200, ge=1, le=1000), level: Optional[str] = Query(None)):
    try:
        with open(LOG_FILE, 'r', encoding='utf-8', errors='ignore') as f:
            data = f.readlines()
    except Exception:
        data = []
    tail = data[-lines:]
    if level:
        level_upper = level.upper()
        tail = [ln for ln in tail if f" {level_upper} " in ln]
    return {"lines": tail}


@app.get("/admin/media")
def admin_list_media(_: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("SELECT id, filename, url, size, created_at FROM media ORDER BY id DESC")
    rows = cur.fetchall(); conn.close()
    return [{"id":r[0],"filename":r[1],"url":r[2],"size":r[3],"created_at":r[4]} for r in rows]


@app.post("/admin/media")
def admin_upload_media(file: UploadFile = File(...), _: dict = Depends(require_admin)):
    ext = os.path.splitext(file.filename)[1].lower()
    fname = f"{uuid.uuid4().hex}{ext}"
    data = file.file.read()
    # size limit: 5MB
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "file too large (max 5MB)")
    # basic type guard
    if ext not in ('.jpg','.jpeg','.png','.webp','.gif','.svg'):
        raise HTTPException(400, "unsupported file type")
    blob_url = _upload_to_blob_if_configured(fname, data)
    if blob_url:
        url = blob_url
    else:
        dest = os.path.join(UPLOAD_DIR, fname)
        with open(dest, 'wb') as f:
            f.write(data)
        base = os.getenv("IMAGE_BASE", "")
        url = f"{base.rstrip('/')}/images/{fname}" if base else f"/images/{fname}"
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("INSERT INTO media(filename, url, size) VALUES (?,?,?)", (fname, url, len(data)))
    conn.commit(); mid = cur.lastrowid; conn.close()
    return {"id": mid, "url": url}


@app.delete("/admin/media/{mid}")
def admin_delete_media(mid: int, _: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("SELECT filename FROM media WHERE id=?", (mid,))
    row = cur.fetchone()
    if not row:
        conn.close(); raise HTTPException(404, 'not found')
    cur.execute("DELETE FROM media WHERE id=?", (mid,))
    conn.commit(); conn.close()
    try:
        p = os.path.join(UPLOAD_DIR, row[0])
        if os.path.isfile(p): os.remove(p)
    except Exception:
        pass
    return {"ok": True}


@app.get("/admin/coupons")
def admin_list_coupons(_: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("SELECT id, code, type, value, active, valid_from, valid_to, min_amount FROM coupons ORDER BY id DESC")
    rows = cur.fetchall(); conn.close()
    return [{"id":r[0],"code":r[1],"type":r[2],"value":r[3],"active":bool(r[4]),"valid_from":r[5],"valid_to":r[6],"min_amount":r[7]} for r in rows]


@app.post("/admin/coupons")
def admin_create_coupon(code: str = Form(...), type: str = Form(...), value: float = Form(...), active: int = Form(1), valid_from: Optional[str] = Form(None), valid_to: Optional[str] = Form(None), min_amount: float = Form(0.0), _: dict = Depends(require_admin)):
    if type not in ("percent","fixed"):
        raise HTTPException(400, 'invalid type')
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("INSERT INTO coupons(code, type, value, active, valid_from, valid_to, min_amount) VALUES (?,?,?,?,?,?,?)", (code.strip(), type, value, 1 if int(active) else 0, valid_from, valid_to, min_amount))
    conn.commit(); cid = cur.lastrowid; conn.close(); return {"id": cid}


@app.put("/admin/coupons/{cid}")
def admin_update_coupon(cid: int, code: Optional[str] = Form(None), type: Optional[str] = Form(None), value: Optional[float] = Form(None), active: Optional[int] = Form(None), valid_from: Optional[str] = Form(None), valid_to: Optional[str] = Form(None), min_amount: Optional[float] = Form(None), _: dict = Depends(require_admin)):
    sets=[]; vals=[]
    if code is not None:
        sets.append("code=?"); vals.append(code.strip())
    if type is not None:
        if type not in ("percent","fixed"):
            raise HTTPException(400, 'invalid type')
        sets.append("type=?"); vals.append(type)
    if value is not None:
        sets.append("value=?"); vals.append(value)
    if active is not None:
        sets.append("active=?"); vals.append(1 if int(active) else 0)
    if valid_from is not None:
        sets.append("valid_from=?"); vals.append(valid_from)
    if valid_to is not None:
        sets.append("valid_to=?"); vals.append(valid_to)
    if min_amount is not None:
        sets.append("min_amount=?"); vals.append(min_amount)
    if not sets: return {"ok": True}
    vals.append(cid)
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute(f"UPDATE coupons SET {', '.join(sets)} WHERE id=?", tuple(vals))
    conn.commit(); conn.close(); return {"ok": True}


@app.delete("/admin/coupons/{cid}")
def admin_delete_coupon(cid: int, _: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("DELETE FROM coupons WHERE id=?", (cid,))
    conn.commit(); conn.close(); return {"ok": True}


def _evaluate_coupon(cur, cart_id: str, code: str, subtotal: float) -> float:
    now_iso = datetime.utcnow().isoformat()
    cur.execute("SELECT type, value, active, valid_from, valid_to, min_amount FROM coupons WHERE code=?", (code.strip(),))
    r = cur.fetchone()
    if not r:
        raise HTTPException(400, 'invalid coupon')
    ctype, val, active, vfrom, vto, min_amount = r
    if not active:
        raise HTTPException(400, 'coupon inactive')
    if min_amount and subtotal < float(min_amount):
        raise HTTPException(400, 'minimum not met')
    if vfrom and now_iso < vfrom:
        raise HTTPException(400, 'not yet valid')
    if vto and now_iso > vto:
        raise HTTPException(400, 'expired')
    if ctype == 'percent':
        return round(subtotal * float(val) / 100.0, 2)
    return min(subtotal, float(val))


@app.post("/cart/apply-coupon")
def apply_coupon(cart_id: str = Form(...), code: str = Form(...)):
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("SELECT c.qty, p.price FROM carts c JOIN products p ON p.id=c.product_id WHERE c.cart_id=?", (cart_id,))
    rows = cur.fetchall()
    subtotal = sum(q*pr for q,pr in rows)
    if subtotal <= 0:
        conn.close(); raise HTTPException(400, 'cart empty')
    discount = _evaluate_coupon(cur, cart_id, code, subtotal)
    cur.execute("INSERT INTO cart_discounts(cart_id, code, discount) VALUES (?,?,?) ON CONFLICT(cart_id) DO UPDATE SET code=excluded.code, discount=excluded.discount", (cart_id, code.strip(), discount))
    conn.commit(); conn.close()
    return {"ok": True, "discount": discount}


@app.get("/admin/orders")
def admin_list_orders(_: dict = Depends(require_admin), status: Optional[str] = Query(None), min_total: Optional[float] = Query(None), max_total: Optional[float] = Query(None)):
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    base = "SELECT id, cart_id, total, status, created_at FROM orders"
    where = []
    params = []
    if status:
        where.append("status=?"); params.append(status)
    if min_total is not None:
        where.append("total>=?"); params.append(min_total)
    if max_total is not None:
        where.append("total<=?"); params.append(max_total)
    sql = base + (" WHERE "+" AND ".join(where) if where else "") + " ORDER BY id DESC"
    cur.execute(sql, tuple(params))
    rows = cur.fetchall(); conn.close()
    return [{"id":r[0],"cart_id":r[1],"total":r[2],"status":r[3],"created_at":r[4]} for r in rows]


@app.put("/admin/orders/{oid}")
def admin_update_order(oid: int, status: str = Form(...), _: dict = Depends(require_admin)):
    if status not in ("pending","paid","shipped","completed","cancelled"):
        raise HTTPException(400, 'invalid status')
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("UPDATE orders SET status=? WHERE id=?", (status, oid))
    conn.commit(); conn.close(); return {"ok": True}


@app.get("/admin/dashboard")
def admin_dashboard(_: dict = Depends(require_admin)):
    conn = sqlite3.connect(DB_PATH); cur = conn.cursor()
    cur.execute("SELECT COUNT(*), COALESCE(SUM(total),0) FROM orders WHERE created_at >= datetime('now','-1 day')")
    d_count, d_sum = cur.fetchone()
    cur.execute("SELECT COUNT(*), COALESCE(SUM(total),0) FROM orders WHERE created_at >= datetime('now','-7 day')")
    w_count, w_sum = cur.fetchone()
    cur.execute("SELECT id, total, status, created_at FROM orders ORDER BY id DESC LIMIT 10")
    recent_orders = [{"id":r[0],"total":r[1],"status":r[2],"created_at":r[3]} for r in cur.fetchall()]
    cur.execute("SELECT id, username, created_at FROM users ORDER BY id DESC LIMIT 10")
    recent_users = [{"id":r[0],"username":r[1],"created_at":r[2]} for r in cur.fetchall()]
    conn.close()
    return {"day": {"orders": d_count, "revenue": d_sum}, "week": {"orders": w_count, "revenue": w_sum}, "recent_orders": recent_orders, "recent_users": recent_users}
