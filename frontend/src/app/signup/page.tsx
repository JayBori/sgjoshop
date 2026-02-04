'use client'
import { useEffect, useState } from 'react'
import { getApiBase } from "../../lib/getApiBase"

const apiBase = getApiBase()

export default function SignupPage(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [available, setAvailable] = useState<boolean|null>(null)
  const [msg, setMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(()=>{ setMsg('') }, [username, password, confirm])

  async function checkDup(){
    setAvailable(null)
    const u = username.trim()
    if(u.length < 3) return
    try{
      const r = await fetch(`${apiBase}/auth/check-username?u=${encodeURIComponent(u)}`)
      if(r.ok){ const j = await r.json(); setAvailable(j.available) }
    }catch{}
  }

  const valid = username.trim().length>=3 && password.length>=6 && password===confirm && available===true

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if(!valid){ setMsg('입력값을 확인하세요'); return }
    try{
      setSubmitting(true)
      const body = new URLSearchParams({ username: username.trim(), password })
      const res = await fetch(`${apiBase}/auth/signup`, { method: 'POST', body })
      if(!res.ok){ setMsg('가입 실패'); return }
      setMsg('가입 완료! 로그인 해주세요.')
    }catch{ setMsg('네트워크 오류') }
    finally{ setSubmitting(false) }
  }

  return (
    <main className="container" style={{maxWidth:480}}>
      <h1>회원가입</h1>
      <form onSubmit={onSubmit}>
        <div style={{marginBottom:8}}>
          <input placeholder="아이디(3자 이상)" value={username} onChange={e=>setUsername(e.target.value)} onBlur={checkDup} />
          {available===true && <span style={{color:'green', marginLeft:8}}>사용 가능</span>}
          {available===false && <span style={{color:'red', marginLeft:8}}>이미 사용 중</span>}
        </div>
        <div style={{marginBottom:8}}>
          <input type="password" placeholder="비밀번호(6자 이상)" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <div style={{marginBottom:8}}>
          <input type="password" placeholder="비밀번호 확인" value={confirm} onChange={e=>setConfirm(e.target.value)} />
          {confirm && (password===confirm ? <span style={{color:'green', marginLeft:8}}>일치</span> : <span style={{color:'red', marginLeft:8}}>불일치</span>)}
        </div>
        <button type="submit" disabled={!valid || submitting}>가입</button>
      </form>
      {msg && <p>{msg}</p>}
      <p><a href="/login">로그인으로</a></p>
    </main>
  )
}
