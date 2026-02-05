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
    const t = localStorage.getItem('token');
    const ia = localStorage.getItem('is_admin');
    if(!t){ location.href='/login'; return }
    if(ia !== '1'){ location.href='/'; return }
    setToken(t)
    fetch(`${getApiBase()}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r=> r.ok ? r.json() : null)
      .then(j=> {
        if(!j?.is_admin){ location.href = '/'; return }
        loadProducts(); loadUsers(t);
        loadCategories(t); loadMedia(t); loadCoupons(t); loadOrders(t); loadDashboard(t);
      })
      .catch(()=> { location.href = '/login' })
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

      {/* ...rest of component unchanged (lists/forms/tables)... */}
    </main>
  )
}
