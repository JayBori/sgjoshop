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
        <div style={{ fontWeight: 800, fontSize: 18 }}>?? ??</div>
        <div style={{ opacity: 0.7 }}>???? {count}?</div>
      </div>
      <div className="grid">
        {products.map((p) => (
          <div className="card" key={p.id}>
            <a href={`/product/${p.id}`}>
              <img
                src={p.image_url || "/placeholder.svg"}
                alt={p.name}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
              />
            </a>
            <div className="body">
              <div style={{ fontSize: 12, color: "#777" }}>SGJO</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}><a href={`/product/${p.id}`}>{p.name}</a></div>
              <div style={{ color: "#555", marginTop: 6, height: 36, overflow: "hidden" }}>{p.description}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 8 }}>
                <span className="price">{formatMoney(p.price)}</span>
                <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 12 }}>NEW</span>
              </div>
              <button className="btn" onClick={async () => { await api.add(p.id, 1); await refresh(); }} style={{ marginTop: 10 }}>???? ??</button>
            </div>
          </div>
        ))}
      </div>
      <button className="cart" onClick={() => setOpen(true)}>???? {count}</button>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
