'use client'
import { useEffect, useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE!

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
    if(!confirm('?????????')) return
    const res = await fetch(`${apiBase}/admin/products/${pid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if(res.ok) loadProducts()
  }

  return (
    <main className="container">
      <h1>???</h1>
      <div style={{marginBottom:12}}>
        <button onClick={()=>setTab('products')}>??</button>
        <button onClick={()=>setTab('users')} style={{marginLeft:8}}>???</button>
      </div>

      {tab==='products' && (
        <section>
          <h2>?? ??</h2>
          <form onSubmit={(e)=>{ e.preventDefault(); createOrUpdate(e.currentTarget as HTMLFormElement) }}>
            <input name="sku" placeholder="SKU" required />
            <input name="name" placeholder="???" required />
            <input name="description" placeholder="??" />
            <input name="price" type="number" step="0.01" placeholder="??" required />
            <input name="stock" type="number" placeholder="??" defaultValue={0} />
            <input name="image" type="file" accept="image/*" />
            <button type="submit">??</button>
          </form>

          <h2 style={{marginTop:24}}>?? ??</h2>
          <table>
            <thead><tr><th>ID</th><th>???</th><th>???</th><th>??</th><th>??</th><th>??/??</th></tr></thead>
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
                      <summary>??</summary>
                      <form onSubmit={(e)=>{ e.preventDefault(); createOrUpdate(e.currentTarget as HTMLFormElement, p.id) }}>
                        <input name="sku" placeholder="SKU" defaultValue={p.sku} />
                        <input name="name" placeholder="???" defaultValue={p.name} />
                        <input name="description" placeholder="??" defaultValue={p.description||''} />
                        <input name="price" type="number" step="0.01" placeholder="??" defaultValue={p.price} />
                        <input name="stock" type="number" placeholder="??" defaultValue={p.stock} />
                        <input name="image" type="file" accept="image/*" />
                        <button type="submit">??</button>
                      </form>
                    </details>
                    <button onClick={()=>del(p.id)} style={{marginLeft:8}}>??</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab==='users' && (
        <section>
          <h2>??? ??</h2>
          <table>
            <thead><tr><th>ID</th><th>???</th><th>???</th><th>PW????</th><th>???</th></tr></thead>
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
