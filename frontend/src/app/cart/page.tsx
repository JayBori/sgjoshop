'use client'
import { useEffect, useState } from 'react'
import { useCartApi, CartState } from '../../lib/useCartApi'

function formatMoney(v: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'USD' }).format(v);
}

export default function CartPage(){
  const api = useCartApi()
  const [state, setState] = useState<CartState>({ cart_id:'', count:0, total:0, items:[] } as any)
  const [code, setCode] = useState('')
  const refresh = async ()=> setState(await api.get())
  useEffect(()=>{ refresh() }, [])

  const apply = async () => {
    if(!code.trim()) return
    try{ await api.applyCoupon(code.trim()); await refresh() }catch(e:any){ alert(e.message||'쿠폰 적용 실패') }
  }
  const checkout = async () => {
    try{ const r = await api.checkout(); alert(`주문번호: ${r.order_id}`); await refresh() }catch(e:any){ alert(e.message||'결제 실패') }
  }
  return (
    <main className="container" style={{paddingTop:24,paddingBottom:24}}>
      <h1>장바구니</h1>
      {state.items.length===0 && <p>장바구니가 비어있습니다.</p>}
      {state.items.map(it=> (
        <div key={it.product_id} style={{display:'flex', gap:12, padding:'8px 0', borderBottom:'1px solid #eee'}}>
          <img src={it.image_url||'/placeholder.svg'} width={64} height={64} style={{objectFit:'cover', borderRadius:8}} />
          <div style={{flex:1}}>
            <div style={{fontWeight:700}}>{it.name}</div>
            <div>수량 {it.qty}</div>
          </div>
          <div style={{fontWeight:700}}>{formatMoney(it.line_total)}</div>
        </div>
      ))}
      <div style={{marginTop:16, display:'flex', gap:8, alignItems:'center'}}>
        <input placeholder="쿠폰 코드" value={code} onChange={e=>setCode(e.target.value)} />
        <button className="btn" onClick={apply}>쿠폰 적용</button>
      </div>
      <div style={{marginTop:16}}>
        <div>합계: {formatMoney(state.total||0)}</div>
        {state.discount? <div>할인{state.coupon?`(${state.coupon})`:''}: -{formatMoney(state.discount||0)}</div>: null}
        <div style={{fontWeight:800}}>결제금액: {formatMoney((state.final_total??state.total)||0)}</div>
      </div>
      <div style={{marginTop:16}}>
        <button className="btn" onClick={checkout}>결제하기</button>
      </div>
    </main>
  )
}

