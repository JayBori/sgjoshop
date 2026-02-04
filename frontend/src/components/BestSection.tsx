"use client";
import React from "react";

function formatMoney(v: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(v * 1350);
}

export default function BestSection({ products }: { products: any[] }) {
  const [period, setPeriod] = React.useState<"realtime" | "daily" | "weekly" | "monthly">("daily");
  const list = products.slice(0, 8);
  const scRef = React.useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    const el = scRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollBy({ left: dir * (w - 80), behavior: "smooth" });
  };

  return (
    <section className="container" style={{ paddingTop: 32, paddingBottom: 24 }}>
      <h2 style={{ textAlign: "center", margin: 0, fontSize: 28, fontWeight: 800 }}>Best</h2>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
        {[
          { k: "realtime", t: "실시간" },
          { k: "daily", t: "일간" },
          { k: "weekly", t: "주간" },
          { k: "monthly", t: "월간" },
        ].map((x) => (
          <button
            key={x.k}
            className="tab"
            data-active={period === x.k}
            onClick={() => setPeriod(x.k as any)}
          >
            {x.t}
          </button>
        ))}
      </div>

      <div className="carousel">
        <button className="nav prev" aria-label="이전" onClick={() => scroll(-1)}>
          ‹
        </button>
        <div className="track" ref={scRef}>
          {list.map((p, i) => (
            <div className="slide" key={p.id}>
              <div className="rank">{i + 1}</div>
              <img
                src={p.image_url || "/placeholder.svg"}
                alt={p.name}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
              <div className="meta">
                <div className="brand">SGJO</div>
                <div className="name">{p.name}</div>
                <div className="price">{formatMoney(p.price)}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="nav next" aria-label="다음" onClick={() => scroll(1)}>
          ›
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
        <a
          className="btn"
          style={{ background: "#fff", color: "#111", border: "1px solid #e5e7eb" }}
          href="#products"
        >
          베스트 상품 더보기
        </a>
      </div>
    </section>
  );
}
