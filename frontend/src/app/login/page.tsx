'use client'
import { useState } from 'react'

const apiBase = process.env.NEXT_PUBLIC_API_BASE!

export default function LoginPage(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const body = new URLSearchParams({ username, password })
    const res = await fetch(`${apiBase}/auth/login`, { method: 'POST', body })
    if(!res.ok){ setError('??? ??'); return }
    const data = await res.json()
    localStorage.setItem('token', data.access_token)
    if(data.must_change_password){
      localStorage.setItem('mustChangePassword','1')
      location.href = '/change-password'
    } else {
      location.href = '/admin'
    }
  }
  return (
    <main className="container" style={{maxWidth:480}}>
      <h1>???</h1>
      <form onSubmit={onSubmit}>
        <input placeholder="???" value={username} onChange={e=>setUsername(e.target.value)} />
        <input type="password" placeholder="????" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit">???</button>
      </form>
      {error && <p style={{color:'red'}}>{error}</p>}
      <p><a href="/signup">????</a></p>
    </main>
  )
}

