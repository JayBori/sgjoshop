"use client";
import React from "react";
import CartDrawer from "./CartDrawer";
import { useCartApi } from "../lib/useCartApi";

function formatMoney(v: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "USD" }).format(v);
}

export default function ProductGrid({ products }: { products: any[] }) {
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

