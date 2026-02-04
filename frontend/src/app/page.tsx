export const dynamic = "force-dynamic";

async function getProducts() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE!;
  const res = await fetch(`${apiBase}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
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

import ProductGrid from "../components/ProductGrid";
import BestSection from "../components/BestSection";

export default async function Home() {
  const products = await getProducts();
  return (
    <main>
      <Hero />
      <BestSection products={products} />
      <ProductGrid products={products} />
    </main>
  );
}
