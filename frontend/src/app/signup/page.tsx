'use client'
import { useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE!

export default function SignupPage(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    const body = new URLSearchParams({ username, password })
    const res = await fetch(`${apiBase}/auth/signup`, { method: 'POST', body })
    if(!res.ok){ setMsg('?? ??'); return }
    setMsg('?? ??! ??? ????.')
  }
  return (
    <main className="container" style={{maxWidth:480}}>
      <h1>????</h1>
      <form onSubmit={onSubmit}>
        <input placeholder="???" value={username} onChange={e=>setUsername(e.target.value)} />
        <input type="password" placeholder="????" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit">??</button>
      </form>
      {msg && <p>{msg}</p>}
      <p><a href="/login">?????</a></p>
    </main>
  )
}
