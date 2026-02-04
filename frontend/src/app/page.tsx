export const dynamic = "force-dynamic";

import { getApiBase } from "../lib/getApiBase";
import ProductGrid from "../components/ProductGrid";
import BestSection from "../components/BestSection";

async function getProducts() {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

async function getPublicSettings(){
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/settings/public`, { cache: "no-store" });
  if(!res.ok) return {} as any;
  return res.json();
}

function Hero({settings}:{settings:any}){
  const title = settings?.heroTitle || '우리 쇼핑몰에 오신걸 환영합니다';
  const subtitle = settings?.heroSubtitle || '심플한 UI, 빠른 경험';
  return (
    <section className="hero">
      <div className="container">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </section>
  );
}

export default async function Home() {
  const [products, settings] = await Promise.all([getProducts(), getPublicSettings()]);
  return (
    <main>
      <Hero settings={settings} />
      <BestSection products={products} />
      <ProductGrid products={products} />
    </main>
  );
}

