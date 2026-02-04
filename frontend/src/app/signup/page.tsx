'use client'
import { useState } from 'react'

import { getApiBase } from "@/src/lib/getApiBase"\n\nconst apiBase = getApiBase()

export default function SignupPage(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    const body = new URLSearchParams({ username, password })
    const res = await fetch(`${apiBase}/auth/signup`, { method: 'POST', body })
    if(!res.ok){ setMsg('가입 실패'); return }
    setMsg('가입 완료! 로그인 해주세요.')
  }
  return (
    <main className="container" style={{maxWidth:480}}>
      <h1>회원가입</h1>
      <form onSubmit={onSubmit}>
        <input placeholder="아이디" value={username} onChange={e=>setUsername(e.target.value)} />
        <input type="password" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit">가입</button>
      </form>
      {msg && <p>{msg}</p>}
      <p><a href="/login">로그인으로</a></p>
    </main>
  )
}

