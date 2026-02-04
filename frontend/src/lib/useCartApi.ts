"use client";
export type CartState = { cart_id:string; count: number; total: number; discount?: number; final_total?: number; coupon?: string|null; items: Array<{product_id:number;qty:number;name:string;price:number;image_url?:string;line_total:number}> };

import React from "react";
import { getApiBase } from "./getApiBase";

export function useCartApi() {
  const apiBase = getApiBase();
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
    if (!cartId) return { cart_id:"", count: 0, total: 0, items: [] } as any;
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
  async function applyCoupon(code: string): Promise<{ok:boolean;discount:number}> {
    if (!cartId) throw new Error("????? ??????");
    const body = new URLSearchParams({ cart_id: cartId, code });
    const res = await fetch(`${apiBase}/cart/apply-coupon`, { method: "POST", body });
    if (!res.ok) throw new Error("?? ?? ??");
    return res.json();
  }
  async function checkout(): Promise<{ok:boolean;order_id:number;total:number}> {
    const url = `${apiBase}/orders?cart_id=${cartId}`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error("?? ?? ??");
    return res.json();
  }
  return { cartId, get, add, remove, applyCoupon, checkout };
}
