"use client"
import { useEffect, useState } from 'react'
import { getApiBase } from "../../lib/getApiBase"

type Product = { id:number; sku:string; name:string; description:string; price:number; image_url:string; stock:number }

type Category = { id:number; name:string; slug:string; sort:number }
type MediaItem = { id:number; filename:string; url:string; size:number; created_at:string }
type Coupon = { id:number; code:string; type:'percent'|'fixed'; value:number; active:boolean; valid_from?:string; valid_to?:string; min_amount:number }
type Order = { id:number; cart_id:string; total:number; status:string; created_at:string }

type User = { id:number; username:string; is_active:boolean; is_admin:boolean; must_change_password:boolean; last_login?:string }

export default function AdminPage(){
  const [token, setToken] = useState<string|null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [tab, setTab] = useState<'dashboard'|'settings'|'products'|'categories'|'media'|'coupons'|'orders'|'users'|'logs'>('dashboard')
  const [logs, setLogs] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [media, setMedia] = useState<MediaItem[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [dashboard, setDashboard] = useState<any>(null)

  // filters
  const [userQuery, setUserQuery] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [orderMin, setOrderMin] = useState('')
  const [orderMax, setOrderMax] = useState('')

  useEffect(()=>{
    const t = localStorage.getItem('token')
    if(!t){ location.href='/login'; return }
    setToken(t)
    // 관리자 권한 확인
    fetch(`${getApiBase()}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r=> r.ok ? r.json() : null)
      .then(j=> {
        if(!j?.is_admin){ location.href = '/'; return }
        loadProducts(); loadUsers(t);
        loadCategories(t); loadMedia(t); loadCoupons(t); loadOrders(t); loadDashboard(t);
      })
      .catch(()=> { location.href = '/' })
  },[])

  async function loadProducts(){
    const res = await fetch(`${getApiBase()}/products`, { cache:'no-store' })
    if(res.ok) setProducts(await res.json())
  }
  async function loadUsers(t:string){
    const url = userQuery ? `${getApiBase()}/admin/users?query=${encodeURIComponent(userQuery)}` : `${getApiBase()}/admin/users`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
    if(res.ok) setUsers(await res.json())
  }
  async function loadCategories(t:string){
    const r = await fetch(`${getApiBase()}/admin/categories`, { headers: { Authorization: `Bearer ${t}` } });
    if(r.ok) setCategories(await r.json())
  }
  async function loadMedia(t:string){
    const r = await fetch(`${getApiBase()}/admin/media`, { headers: { Authorization: `Bearer ${t}` } });
    if(r.ok) setMedia(await r.json())
  }
  async function loadCoupons(t:string){
    const r = await fetch(`${getApiBase()}/admin/coupons`, { headers: { Authorization: `Bearer ${t}` } });
    if(r.ok) setCoupons(await r.json())
  }
  async function loadOrders(t:string){
    const params = new URLSearchParams()
    if(orderStatus) params.set('status', orderStatus)
    if(orderMin) params.set('min_total', orderMin)
    if(orderMax) params.set('max_total', orderMax)
    const r = await fetch(`${getApiBase()}/admin/orders?${params.toString()}`, { headers: { Authorization: `Bearer ${t}` } });
    if(r.ok) setOrders(await r.json())
  }
  async function loadDashboard(t:string){
    const r = await fetch(`${getApiBase()}/admin/dashboard`, { headers: { Authorization: `Bearer ${t}` } });
    if(r.ok) setDashboard(await r.json())
  }

  // Products
  async function createOrUpdate(form: HTMLFormElement, pid?: number){
    if(!token) return
    const fd = new FormData(form)
    const method = pid ? 'PUT' : 'POST'
    const url = pid ? `${getApiBase()}/admin/products/${pid}` : `${getApiBase()}/admin/products`
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body: fd })
    if(res.ok){ await loadProducts(); form.reset() }
  }
  async function delProduct(pid:number){
    if(!token) return
    if(!confirm('삭제하시겠습니까?')) return
    const res = await fetch(`${getApiBase()}/admin/products/${pid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if(res.ok) loadProducts()
  }

  // Users
  async function toggleUser(uid:number, nextActive:boolean){
    if(!token) return
    const fd = new FormData(); fd.append('active', nextActive? '1':'0')
    const r = await fetch(`${getApiBase()}/admin/users/${uid}`, { method:'PATCH', headers: { Authorization: `Bearer ${token}` }, body: fd })
    if(r.ok && token) loadUsers(token)
  }
  async function deleteUser(uid:number){
    if(!token) return
    if(!confirm('해당 사용자를 삭제할까요?')) return
    const r = await fetch(`${getApiBase()}/admin/users/${uid}`, { method:'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if(r.ok && token) loadUsers(token)
  }

  // Settings
  async function saveSettings(form: HTMLFormElement){
    if(!token) return;
    const fd = new FormData(form);
    const payload: any = {};
    fd.forEach((v,k)=> payload[k]=String(v));
    await fetch(`${getApiBase()}/admin/settings`, { method:'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    alert('설정이 저장되었습니다');
  }

  // Categories
  async function createCategory(form: HTMLFormElement){
    if(!token) return; const fd = new FormData(form);
    const r = await fetch(`${getApiBase()}/admin/categories`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: fd });
    if(r.ok) { form.reset(); loadCategories(token!); }
  }
  async function updateCategory(id:number, form: HTMLFormElement){
    if(!token) return; const fd = new FormData(form);
    const r = await fetch(`${getApiBase()}/admin/categories/${id}`, { method:'PUT', headers:{ Authorization:`Bearer ${token}` }, body: fd });
    if(r.ok) loadCategories(token!);
  }
  async function deleteCategory(id:number){
    if(!token) return; if(!confirm('카테고리 삭제?')) return;
    const r = await fetch(`${getApiBase()}/admin/categories/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } });
    if(r.ok) loadCategories(token!);
  }

  // Media
  async function uploadMedia(input: HTMLInputElement){
    if(!token || !input.files || input.files.length===0) return;
    const fd = new FormData(); fd.append('file', input.files[0]);
    const r = await fetch(`${getApiBase()}/admin/media`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: fd });
    if(r.ok) loadMedia(token!);
  }
  async function deleteMedia(id:number){
    if(!token) return; if(!confirm('미디어 삭제?')) return;
    const r = await fetch(`${getApiBase()}/admin/media/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } });
    if(r.ok) loadMedia(token!);
  }

  // Coupons
  async function createCoupon(form: HTMLFormElement){
    if(!token) return; const fd = new FormData(form);
    const r = await fetch(`${getApiBase()}/admin/coupons`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: fd });
    if(r.ok){ form.reset(); loadCoupons(token!); }
  }
  async function updateCoupon(id:number, form: HTMLFormElement){
    if(!token) return; const fd = new FormData(form);
    const r = await fetch(`${getApiBase()}/admin/coupons/${id}`, { method:'PUT', headers:{ Authorization:`Bearer ${token}` }, body: fd });
    if(r.ok) loadCoupons(token!);
  }
  async function deleteCoupon(id:number){
    if(!token) return; if(!confirm('쿠폰 삭제?')) return;
    const r = await fetch(`${getApiBase()}/admin/coupons/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` } });
    if(r.ok) loadCoupons(token!);
  }

  // Orders
  async function updateOrderStatus(id:number, status:string){
    if(!token) return; const fd = new FormData(); fd.append('status', status);
    const r = await fetch(`${getApiBase()}/admin/orders/${id}`, { method:'PUT', headers:{ Authorization:`Bearer ${token}` }, body: fd });
    if(r.ok) loadOrders(token!);
  }
  async function loadLogs(level?: string){
    if(!token) return;
    const url = new URL(`${getApiBase()}/admin/logs`, location.origin)
    if(level) url.searchParams.set('level', level)
    const r = await fetch(url.toString(), { headers:{ Authorization:`Bearer ${token}` } });
    if(r.ok){ const j = await r.json(); setLogs(j.lines||[]) }
  }

  return (
    <main className="container">
      <h1>관리자</h1>
      <div style={{marginBottom:12, display:'flex', gap:8, flexWrap:'wrap'}}>
        <button onClick={()=>setTab('dashboard')}>📊 대시보드</button>
        <button onClick={()=>setTab('settings')}>⚙️ 설정</button>
        <button onClick={()=>setTab('products')}>📦 상품</button>
        <button onClick={()=>setTab('categories')}>🧩 카테고리</button>
        <button onClick={()=>setTab('media')}>🖼️ 미디어</button>
        <button onClick={()=>setTab('coupons')}>🎟️ 쿠폰</button>
        <button onClick={()=>setTab('orders')}>🧾 주문</button>
        <button onClick={()=>setTab('users')}>👥 사용자</button>
        <button onClick={()=>{ setTab('logs'); loadLogs(); }}>🧩 로그</button>
      </div>

      {tab==='dashboard' && dashboard && (
        <section>
          <h2>대시보드</h2>
          <div>어제 주문수: {dashboard.day.orders} / 매출: {dashboard.day.revenue}</div>
          <div>7일 주문수: {dashboard.week.orders} / 매출: {dashboard.week.revenue}</div>
          <h3 style={{marginTop:12}}>최근 주문</h3>
          <ul>{dashboard.recent_orders.map((o:any)=> <li key={o.id}>#{o.id} {o.total} {o.status} {o.created_at}</li>)}</ul>
          <h3>최근 가입자</h3>
          <ul>{dashboard.recent_users.map((u:any)=> <li key={u.id}>#{u.id} {u.username} {u.created_at}</li>)}</ul>
        </section>
      )}

      {tab==='settings' && (
        <section>
          <h2>설정</h2>
          <form onSubmit={(e)=>{ e.preventDefault(); saveSettings(e.currentTarget as HTMLFormElement) }}>
            <input name="promoText" placeholder="프로모션 문구" />
            <input name="heroTitle" placeholder="히어로 타이틀" />
            <input name="heroSubtitle" placeholder="히어로 서브타이틀" />
            <input name="title" placeholder="SEO 타이틀" />
            <input name="description" placeholder="SEO 설명" />
            <input name="ogImage" placeholder="OG 이미지 URL" />
            <input name="footerText" placeholder="푸터 텍스트" />
            <button type="submit">저장</button>
          </form>
        </section>
      )}

      {tab==='products' && (
        <section>
          <h2>상품 관리</h2>
          <form onSubmit={(e)=>{ e.preventDefault(); createOrUpdate(e.currentTarget as HTMLFormElement) }}>
            <input name="sku" placeholder="SKU" required />
            <input name="name" placeholder="상품명" required />
            <input name="description" placeholder="설명" />
            <input name="price" type="number" step="0.01" placeholder="가격" required />
            <input name="stock" type="number" placeholder="재고" defaultValue={0} />
            <input name="categories" placeholder="카테고리 ID(csv)" />
            <input name="image" type="file" accept="image/*" />
            <button type="submit">저장</button>
          </form>

          <h3 style={{marginTop:24}}>상품 목록</h3>
          <table>
            <thead><tr><th>ID</th><th>이미지</th><th>이름</th><th>가격</th><th>재고</th><th>수정/삭제</th></tr></thead>
            <tbody>
              {products.map(p=> (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.image_url ? <img src={p.image_url} width={40}/> : '-'}</td>
                  <td>{p.name}</td>
                  <td>{p.price}</td>
                  <td>{p.stock}</td>
                  <td>
                    <details>
                      <summary>수정</summary>
                      <form onSubmit={(e)=>{ e.preventDefault(); createOrUpdate(e.currentTarget as HTMLFormElement, p.id) }}>
                        <input name="sku" placeholder="SKU" defaultValue={p.sku} />
                        <input name="name" placeholder="상품명" defaultValue={p.name} />
                        <input name="description" placeholder="설명" defaultValue={p.description||''} />
                        <input name="price" type="number" step="0.01" placeholder="가격" defaultValue={p.price} />
                        <input name="stock" type="number" placeholder="재고" defaultValue={p.stock} />
                        <input name="categories" placeholder="카테고리 ID(csv)" />
                        <input name="image" type="file" accept="image/*" />
                        <button type="submit">저장</button>
                      </form>
                    </details>
                    <button onClick={()=>delProduct(p.id)} style={{marginLeft:8}}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab==='categories' && (
        <section>
          <h2>카테고리</h2>
          <form onSubmit={(e)=>{e.preventDefault(); createCategory(e.currentTarget as HTMLFormElement)}}>
            <input name="name" placeholder="이름" />
            <input name="sort" placeholder="정렬" type="number" defaultValue={0} />
            <button type="submit">추가</button>
          </form>
          <table><thead><tr><th>ID</th><th>이름/정렬</th><th>동작</th></tr></thead><tbody>
            {categories.map(c=> (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>
                  <form onSubmit={(e)=>{e.preventDefault(); updateCategory(c.id, e.currentTarget as HTMLFormElement)}}>
                    <input name="name" defaultValue={c.name} />
                    <input name="sort" type="number" defaultValue={c.sort} />
                    <button type="submit">수정</button>
                  </form>
                </td>
                <td><button onClick={()=>deleteCategory(c.id)}>삭제</button></td>
              </tr>
            ))}
          </tbody></table>
        </section>
      )}

      {tab==='media' && (
        <section>
          <h2>미디어</h2>
          <input type="file" onChange={(e)=> uploadMedia(e.currentTarget)} />
          <ul>
            {media.map(m=> (
              <li key={m.id}><a href={m.url} target="_blank">{m.filename}</a> ({Math.round(m.size/1024)} KB) <button onClick={()=>deleteMedia(m.id)}>삭제</button></li>
            ))}
          </ul>
        </section>
      )}

      {tab==='coupons' && (
        <section>
          <h2>쿠폰</h2>
          <form onSubmit={(e)=>{e.preventDefault(); createCoupon(e.currentTarget as HTMLFormElement)}}>
            <input name="code" placeholder="CODE" />
            <select name="type"><option value="fixed">fixed</option><option value="percent">percent</option></select>
            <input name="value" placeholder="값" type="number" step="0.01" />
            <input name="min_amount" placeholder="최소금액" type="number" step="0.01" defaultValue={0} />
            <input name="valid_from" placeholder="시작(ISO)" />
            <input name="valid_to" placeholder="종료(ISO)" />
            <button type="submit">추가</button>
          </form>
          <table><thead><tr><th>ID</th><th>코드/타입/값</th><th>활성</th><th>기간</th><th>최소</th><th>동작</th></tr></thead><tbody>
            {coupons.map(c=> (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td colSpan={3}>
                  <form onSubmit={(e)=>{e.preventDefault(); updateCoupon(c.id, e.currentTarget as HTMLFormElement)}}>
                    <input name="code" defaultValue={c.code} />
                    <select name="type" defaultValue={c.type}><option value="fixed">fixed</option><option value="percent">percent</option></select>
                    <input name="value" type="number" step="0.01" defaultValue={c.value} />
                    <select name="active" defaultValue={c.active?'1':'0'}><option value="1">활성</option><option value="0">비활성</option></select>
                    <input name="valid_from" defaultValue={c.valid_from||''} />
                    <input name="valid_to" defaultValue={c.valid_to||''} />
                    <input name="min_amount" type="number" step="0.01" defaultValue={c.min_amount} />
                    <button type="submit">수정</button>
                  </form>
                </td>
                <td></td>
                <td><button onClick={()=>deleteCoupon(c.id)}>삭제</button></td>
              </tr>
            ))}
          </tbody></table>
        </section>
      )}

      {tab==='orders' && (
        <section>
          <h2>주문</h2>
          <div style={{marginBottom:8, display:'flex', gap:8, alignItems:'center'}}>
            <select value={orderStatus} onChange={e=>setOrderStatus(e.target.value)}>
              <option value="">전체</option>
              <option value="pending">pending</option>
              <option value="paid">paid</option>
              <option value="shipped">shipped</option>
              <option value="completed">completed</option>
              <option value="cancelled">cancelled</option>
            </select>
            <input value={orderMin} onChange={e=>setOrderMin(e.target.value)} placeholder="최소금액" type="number" step="0.01" />
            <input value={orderMax} onChange={e=>setOrderMax(e.target.value)} placeholder="최대금액" type="number" step="0.01" />
            <button onClick={()=> token && loadOrders(token)}>필터</button>
          </div>
          <table><thead><tr><th>ID</th><th>Cart</th><th>Total</th><th>Status</th><th>At</th><th>동작</th></tr></thead><tbody>
            {orders.map(o=> (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.cart_id}</td>
                <td>{o.total}</td>
                <td>{o.status}</td>
                <td>{o.created_at}</td>
                <td>
                  {['pending','paid','shipped','completed','cancelled'].map(s=> (
                    <button key={s} onClick={()=>updateOrderStatus(o.id, s)} disabled={o.status===s} style={{marginRight:4}}>{s}</button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody></table>
        </section>
      )}

      {tab==='users' && (
        <section>
          <h2>사용자 관리</h2>
          <div style={{marginBottom:8}}>
            <input placeholder="검색(아이디)" value={userQuery} onChange={e=>setUserQuery(e.target.value)} />
            <button onClick={()=> token && loadUsers(token)}>검색</button>
          </div>
          <table>
            <thead><tr><th>ID</th><th>아이디</th><th>상태</th><th>역할</th><th>비번변경필수</th><th>최근로그인</th><th>동작</th></tr></thead>
            <tbody>
              {users.map(u=> (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.is_active? 'Active':'Inactive'}</td>
                  <td>{u.is_admin? 'Admin':'User'}</td>
                  <td>{u.must_change_password? 'Y':'N'}</td>
                  <td>{u.last_login || '-'}</td>
                  <td>
                    <button onClick={()=>toggleUser(u.id, !u.is_active)}>{u.is_active? '비활성':'활성'}</button>
                    <button onClick={()=>deleteUser(u.id)} style={{marginLeft:8}}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab==='logs' && (
        <section>
          <h2>로그 뷰어</h2>
          <div style={{marginBottom:8}}>
            <button onClick={()=>loadLogs()}>전체</button>
            <button onClick={()=>loadLogs('INFO')} style={{marginLeft:4}}>INFO</button>
            <button onClick={()=>loadLogs('WARNING')} style={{marginLeft:4}}>WARNING</button>
            <button onClick={()=>loadLogs('ERROR')} style={{marginLeft:4}}>ERROR</button>
          </div>
          <pre style={{background:'#0b1020', color:'#e5e7eb', padding:12, borderRadius:8, maxHeight:400, overflow:'auto'}}>
{logs.join('\n')}
          </pre>
        </section>
      )}
    </main>
  )
}
