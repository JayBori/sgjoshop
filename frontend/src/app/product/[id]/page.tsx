import { getApiBase } from "../../../lib/getApiBase";

export const dynamic = "force-dynamic";

function formatMoney(v: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "USD" }).format(v);
}

async function getProduct(id: string){
  const res = await fetch(`${getApiBase()}/products/${id}`, { cache: 'no-store' });
  if(!res.ok) throw new Error('??? ???? ?????');
  return res.json();
}

export async function generateMetadata({ params }: { params: { id: string }}){
  try{
    const p = await getProduct(params.id);
    return { title: `${p.name} - SGJO Shop`, description: (p.description||'').slice(0,120) };
  }catch{ return { title: '?? - SGJO Shop' }; }
}

export default async function ProductDetail({ params }: { params: { id: string }}){
  const p = await getProduct(params.id);
  const badge = p.stock > 50 ? 'BEST' : (p.stock > 0 ? 'LOW' : 'SOLD OUT');
  return (
    <main className="container" style={{paddingTop:24,paddingBottom:24}}>
      <div style={{display:'flex', gap:24, alignItems:'flex-start'}}>
        <img src={p.image_url||'/placeholder.svg'} alt={p.name} style={{width:360, height:360, objectFit:'cover', borderRadius:8}} />
        <div style={{flex:1}}>
          <h1>{p.name} {badge!=='SOLD OUT' ? <span style={{fontSize:12, color:'#ef4444', marginLeft:8}}>{badge}</span> : <span style={{fontSize:12, color:'#666', marginLeft:8}}>{badge}</span>}</h1>
          <div style={{marginTop:8}}>{p.description}</div>
          <div style={{marginTop:12, fontWeight:700, fontSize:20}}>{formatMoney(p.price)}</div>
          <div style={{marginTop:8, color:'#666'}}>??: {p.stock}</div>
          <div style={{marginTop:16, padding:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:8}}>
            <strong>?? ??</strong>
            <div>?? ?? 2? ?? ?? ? ?? ?????.</div>
          </div>
          <div style={{marginTop:12}}>
            <a className="btn" href="/">???</a>
          </div>
        </div>
      </div>
    </main>
  );
}
