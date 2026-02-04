'use client'
import { useEffect, useState } from 'react'

import { getApiBase } from "@/src/lib/getApiBase"\n\nconst apiBase = getApiBase()

export default function ChangePasswordPage(){
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  useEffect(()=>{
    const must = localStorage.getItem('mustChangePassword')
    if(!must){ location.href = '/admin' }
  },[])
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const token = localStorage.getItem('token')
    if(!token){ setError('로그인이 필요합니다'); return }
    const body = new URLSearchParams({ new_password: newPassword })
    const res = await fetch(`${apiBase}/auth/change-password`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body })
    if(!res.ok){ setError('변경 실패'); return }
    localStorage.removeItem('mustChangePassword')
    setOk(true)
    setTimeout(()=>location.href='/admin', 600)
  }
  return (
    <main className="container" style={{maxWidth:480}}>
      <h1>비밀번호 변경</h1>
      <form onSubmit={onSubmit}>
        <input type="password" placeholder="새 비밀번호" value={newPassword} onChange={e=>setNewPassword(e.target.value)} />
        <button type="submit">변경</button>
      </form>
      {error && <p style={{color:'red'}}>{error}</p>}
      {ok && <p>변경 완료</p>}
    </main>
  )
}

