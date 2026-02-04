import { getApiBase } from "../../../lib/getApiBase";

export const dynamic = "force-dynamic";

function formatMoney(v: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "USD" }).format(v);
}

async function getProduct(id: string){
  const res = await fetch(`${getApiBase()}/products/${id}`, { cache: 'no-store' });
  if(!res.ok) throw new Error('상품을 불러오지 못했습니다');
  return res.json();
}

export default async function ProductDetail({ params }: { params: { id: string }}){
  const p = await getProduct(params.id);
  return (
    <main className="container" style={{paddingTop:24,paddingBottom:24}}>
      <div style={{display:'flex', gap:24}}>
        <img src={p.image_url||'/placeholder.svg'} alt={p.name} style={{width:360, height:360, objectFit:'cover', borderRadius:8}} />
        <div style={{flex:1}}>
          <h1>{p.name}</h1>
          <div style={{marginTop:8}}>{p.description}</div>
          <div style={{marginTop:12, fontWeight:700, fontSize:20}}>{formatMoney(p.price)}</div>
          <div style={{marginTop:8, color:'#666'}}>재고: {p.stock}</div>
          <div style={{marginTop:12}}>
            <a className="btn" href="/">홈으로</a>
          </div>
        </div>
      </div>
    </main>
  );
}

