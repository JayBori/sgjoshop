"use client";
import React from "react";
import { useCartApi, CartState } from "../lib/useCartApi";

function formatMoney(v: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "USD" }).format(v);
}

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const api = useCartApi();
  const [state, setState] = React.useState<CartState>({ cart_id:"", count: 0, total: 0, items: [] } as any);
  const refresh = React.useCallback(async () => setState(await api.get()), [api]);
  React.useEffect(() => { if (open) { refresh(); } }, [open, refresh]);

  return (
    <div style={{ position: "fixed", right: open ? 0 : -360, top: 0, bottom: 0, width: 360, background: "#fff", borderLeft: "1px solid #e5e7eb", boxShadow: "-6px 0 16px rgba(0,0,0,0.06)", transition: "right .25s ease", zIndex: 50 }}>
      <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb" }}>
        <strong>????</strong>
        <button className="btn" onClick={onClose} style={{ background: "#eee", color: "#111" }}>??</button>
      </div>
      <div style={{ padding: 16, overflow: "auto", height: "calc(100% - 180px)" }}>
        {state.items.length === 0 && <div style={{ color: "#666" }}>????? ??????.</div>}
        {state.items.map((it) => (
          <div key={it.product_id} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <img src={it.image_url || "/placeholder.png"} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{it.name}</div>
              <div style={{ color: "#666" }}>?? {it.qty}</div>
              <div style={{ fontWeight: 700 }}>{formatMoney(it.line_total)}</div>
            </div>
            <button className="btn" onClick={async () => { await api.remove(it.product_id); await refresh(); }} style={{ background: "#ef4444" }}>??</button>
          </div>
        ))}
      </div>
      <div style={{ padding: 16, borderTop: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span>??</span>
          <strong>{formatMoney(state.total || 0)}</strong>
        </div>
        {state.discount ? (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span>??{state.coupon? ` (${state.coupon})`: ''}</span>
            <strong>-{formatMoney(state.discount || 0)}</strong>
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span>????</span>
          <strong>{formatMoney((state.final_total ?? state.total) || 0)}</strong>
        </div>
        <a className="btn" style={{ width: "100%", display:'inline-block', textAlign:'center' }} href="/cart">???? ??/?? ??</a>
        <button className="btn" style={{ width: "100%", marginTop:8 }} onClick={async () => {
          try {
            const r = await api.checkout();
            alert(`??? ???????. ????: ${r.order_id}`);
            await refresh();
          } catch (e: any) {
            alert(e.message || "?? ??");
          }
        }}>????</button>
      </div>
    </div>
  );
}
