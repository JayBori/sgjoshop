import { getApiBase } from "../../../lib/getApiBase";
import ProductGrid from "../../../components/ProductGrid";

export const dynamic = "force-dynamic";

async function getProducts(slug: string){
  const res = await fetch(`${getApiBase()}/categories/${slug}/products`, { cache: 'no-store' });
  if(!res.ok) throw new Error('카테고리 상품을 불러오지 못했습니다');
  return res.json();
}

export default async function CategoryPage({ params }: { params: { slug: string }}){
  const products = await getProducts(params.slug);
  return (
    <main>
      <section className="hero"><div className="container"><h1>카테고리: {params.slug}</h1></div></section>
      <ProductGrid products={products} />
    </main>
  );
}

