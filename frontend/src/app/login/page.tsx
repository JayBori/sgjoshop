'use client'
import { useState } from 'react'

import { getApiBase } from "../../lib/getApiBase"



export default function LoginPage(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const body = new URLSearchParams({ username, password })
    const res = await fetch(`${getApiBase()}/auth/login`, { method: 'POST', body })
    if(!res.ok){ setError('로그인 실패'); return }
    const data = await res.json()
    localStorage.setItem('token', data.access_token)
    if(data.must_change_password){
      localStorage.setItem('mustChangePassword','1')
      location.href = data.is_admin ? '/admin' : '/'
  }
  return (
    <main className="container" style={{maxWidth:480}}>
      <h1>로그인</h1>
      <form onSubmit={onSubmit}>
        <input placeholder="아이디" value={username} onChange={e=>setUsername(e.target.value)} />
        <input type="password" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit">로그인</button>
      </form>
      {error && <p style={{color:'red'}}>{error}</p>}
      <p><a href="/signup">회원가입</a></p>
    </main>
  )
}





