export const dynamic = "force-dynamic";

async function getProducts() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE!;
  const res = await fetch(`${apiBase}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

function formatMoney(v: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "USD" }).format(v);
}

function Hero() {
  return (
    <section className="hero">
      <div className="container">
        <h1>당신의 일상을 채우는 쇼핑</h1>
        <p>깔끔한 UI, 간단한 데모. 바로 써보세요.</p>
      </div>
    </section>
  );
}

"use client";
import React from "react";

type CartState = { count: number; total: number; items: Array<{product_id:number;qty:number;name:string;price:number;image_url?:string;line_total:number}> };

function useCartApi() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE!;
  const [cartId, setCartId] = React.useState<string>("");
  React.useEffect(() => {
    let id = localStorage.getItem("cart_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("cart_id", id);
    }
    setCartId(id);
  }, []);

  async function get(): Promise<CartState> {
    if (!cartId) return { count: 0, total: 0, items: [] } as any;
    const res = await fetch(`${apiBase}/cart?cart_id=${cartId}`, { cache: "no-store" });
    return res.json();
  }
  async function add(product_id: number, qty = 1) {
    if (!cartId) return;
    const url = `${apiBase}/cart/items?cart_id=${cartId}&product_id=${product_id}&qty=${qty}`;
    await fetch(url, { method: "POST" });
  }
  async function remove(product_id: number) {
    if (!cartId) return;
    const url = `${apiBase}/cart/items/${product_id}?cart_id=${cartId}`;
    await fetch(url, { method: "DELETE" });
  }
  async function checkout(): Promise<{order_id:number;total:number}> {
    const url = `${apiBase}/orders?cart_id=${cartId}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error("결제 처리 실패");
    return res.json();
  }
  return { cartId, get, add, remove, checkout };
}

function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useCartApi();
  const [state, setState] = React.useState<CartState>({ count: 0, total: 0, items: [] });
  const refresh = React.useCallback(async () => setState(await api.get()), [api]);
  React.useEffect(() => { if (open) { refresh(); } }, [open, refresh]);

  return (
    <div style={{ position: "fixed", right: open ? 0 : -360, top: 0, bottom: 0, width: 360, background: "#fff", borderLeft: "1px solid #e5e7eb", boxShadow: "-6px 0 16px rgba(0,0,0,0.06)", transition: "right .25s ease", zIndex: 50 }}>
      <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb" }}>
        <strong>장바구니</strong>
        <button className="btn" onClick={onClose} style={{ background: "#eee", color: "#111" }}>닫기</button>
      </div>
      <div style={{ padding: 16, overflow: "auto", height: "calc(100% - 140px)" }}>
        {state.items.length === 0 && <div style={{ color: "#666" }}>담긴 상품이 없습니다.</div>}
        {state.items.map((it) => (
          <div key={it.product_id} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <img src={it.image_url || "/placeholder.png"} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{it.name}</div>
              <div style={{ color: "#666" }}>수량 {it.qty}</div>
              <div style={{ fontWeight: 700 }}>{formatMoney(it.line_total)}</div>
            </div>
            <button className="btn" onClick={async () => { await api.remove(it.product_id); await refresh(); }} style={{ background: "#ef4444" }}>삭제</button>
          </div>
        ))}
      </div>
      <div style={{ padding: 16, borderTop: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span>합계</span>
          <strong>{formatMoney(state.total || 0)}</strong>
        </div>
        <button className="btn" style={{ width: "100%" }} onClick={async () => {
          try {
            const r = await api.checkout();
            alert(`주문이 완료되었습니다. 주문번호: ${r.order_id}`);
            await refresh();
          } catch (e: any) {
            alert(e.message || "결제 실패");
          }
        }}>결제하기</button>
      </div>
    </div>
  );
}

function ProductGrid({ products }: { products: any[] }) {
  const api = useCartApi();
  const [open, setOpen] = React.useState(false);
  const [count, setCount] = React.useState(0);
  const refresh = React.useCallback(async () => {
    const c = await api.get();
    setCount(c.count);
  }, [api]);
  React.useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="container" id="products" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div className="toolbar">
        <div style={{ fontWeight: 700 }}>추천 상품</div>
        <div style={{ opacity: 0.7 }}>총 {count}개 담김</div>
      </div>
      <div className="grid">
        {products.map((p) => (
          <div className="card" key={p.id}>
            <img src={p.image_url || "/placeholder.png"} alt={p.name} />
            <div className="body">
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div style={{ color: "#555", marginTop: 6 }}>{p.description}</div>
              <div className="price">{formatMoney(p.price)}</div>
              <button className="btn" onClick={async () => { await api.add(p.id, 1); await refresh(); }} style={{ marginTop: 10 }}>장바구니 담기</button>
            </div>
          </div>
        ))}
      </div>
      <button className="cart" onClick={() => setOpen(true)}>장바구니 {count}</button>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export default async function Home() {
  const products = await getProducts();
  return (
    <main>
      <Hero />
      {/* @ts-expect-error Server-to-Client boundary */}
      <ProductGrid products={products} />
    </main>
  );
}

