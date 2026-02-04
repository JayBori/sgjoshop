'use client'
import { useEffect, useState } from 'react'

import { getApiBase } from "@/src/lib/getApiBase"\n\nconst apiBase = getApiBase()

type Product = { id:number; sku:string; name:string; description:string; price:number; image_url:string; stock:number }

export default function AdminPage(){
  const [token, setToken] = useState<string|null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [tab, setTab] = useState<'products'|'users'>('products')

  useEffect(()=>{
    const t = localStorage.getItem('token')
    if(!t){ location.href='/login'; return }
    setToken(t)
    loadProducts()
    loadUsers(t)
  },[])

  async function loadProducts(){
    const res = await fetch(`${apiBase}/products`, { cache:'no-store' })
    if(res.ok) setProducts(await res.json())
  }
  async function loadUsers(t:string){
    const res = await fetch(`${apiBase}/admin/users`, { headers: { Authorization: `Bearer ${t}` } })
    if(res.ok) setUsers(await res.json())
  }

  async function createOrUpdate(form: HTMLFormElement, pid?: number){
    if(!token) return
    const fd = new FormData(form)
    const method = pid ? 'PUT' : 'POST'
    const url = pid ? `${apiBase}/admin/products/${pid}` : `${apiBase}/admin/products`
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body: fd })
    if(res.ok){ await loadProducts(); form.reset() }
  }

  async function del(pid:number){
    if(!token) return
    if(!confirm('삭제하시겠습니까?')) return
    const res = await fetch(`${apiBase}/admin/products/${pid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if(res.ok) loadProducts()
  }

  return (
    <main className="container">
      <h1>관리자</h1>
      <div style={{marginBottom:12}}>
        <button onClick={()=>setTab('products')}>상품</button>
        <button onClick={()=>setTab('users')} style={{marginLeft:8}}>사용자</button>
      </div>

      {tab==='products' && (
        <section>
          <h2>상품 등록</h2>
          <form onSubmit={(e)=>{ e.preventDefault(); createOrUpdate(e.currentTarget as HTMLFormElement) }}>
            <input name="sku" placeholder="SKU" required />
            <input name="name" placeholder="상품명" required />
            <input name="description" placeholder="설명" />
            <input name="price" type="number" step="0.01" placeholder="가격" required />
            <input name="stock" type="number" placeholder="재고" defaultValue={0} />
            <input name="image" type="file" accept="image/*" />
            <button type="submit">등록</button>
          </form>

          <h2 style={{marginTop:24}}>상품 목록</h2>
          <table>
            <thead><tr><th>ID</th><th>이미지</th><th>상품명</th><th>가격</th><th>재고</th><th>수정/삭제</th></tr></thead>
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
                        <input name="image" type="file" accept="image/*" />
                        <button type="submit">저장</button>
                      </form>
                    </details>
                    <button onClick={()=>del(p.id)} style={{marginLeft:8}}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab==='users' && (
        <section>
          <h2>사용자 목록</h2>
          <table>
            <thead><tr><th>ID</th><th>아이디</th><th>관리자</th><th>PW변경필수</th><th>가입일</th></tr></thead>
            <tbody>
              {users.map(u=> (
                <tr key={u.id}><td>{u.id}</td><td>{u.username}</td><td>{u.is_admin? 'Y':'N'}</td><td>{u.must_change_password? 'Y':'N'}</td><td>{u.created_at}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

