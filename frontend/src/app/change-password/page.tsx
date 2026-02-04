'use client'
import { useEffect, useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE!

export default function ChangePasswordPage(){
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  useEffect(()=>{
    const must = localStorage.getItem('mustChangePassword')
    if(!must){
      // not required, go admin
      location.href = '/admin'
    }
  },[])
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const token = localStorage.getItem('token')
    if(!token){ setError('??? ??'); return }
    const body = new URLSearchParams({ new_password: newPassword })
    const res = await fetch(`${apiBase}/auth/change-password`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body })
    if(!res.ok){ setError('?? ??'); return }
    localStorage.removeItem('mustChangePassword')
    setOk(true)
    setTimeout(()=>location.href='/admin', 600)
  }
  return (
    <main className="container" style={{maxWidth:480}}>
      <h1>???? ??</h1>
      <form onSubmit={onSubmit}>
        <input type="password" placeholder="? ????" value={newPassword} onChange={e=>setNewPassword(e.target.value)} />
        <button type="submit">??</button>
      </form>
      {error && <p style={{color:'red'}}>{error}</p>}
      {ok && <p>?? ??</p>}
    </main>
  )
}

