export const dynamic = "force-dynamic";

async function getProducts() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE!;
  const res = await fetch(`${apiBase}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export default async function Home() {
  const products = await getProducts();

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>SGJO Shop</h1>
      <p>Next.js + FastAPI + PostgreSQL on ACI</p>

      <div style={{ marginTop: 16 }}>
        <a href={`${process.env.NEXT_PUBLIC_API_BASE}/health`} target="_blank">
          API Health
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24 }}>
        {products.map((p: any) => (
          <div key={p.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700 }}>{p.name}</div>
            <div style={{ opacity: 0.8, marginTop: 8 }}>{p.description}</div>
            <div style={{ marginTop: 12, fontWeight: 700 }}>${p.price}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

