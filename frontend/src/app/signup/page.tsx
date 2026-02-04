'use client'
import { useEffect, useState } from 'react'
import { getApiBase } from "../../lib/getApiBase"



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
    if(u.length < 3){ setMsg('아이디는 3자 이상'); return }
    try{
      const r = await fetch(`${getApiBase()}/auth/check-username?u=${encodeURIComponent(u)}`)
      if(r.ok){ const j = await r.json(); setAvailable(j.available) }
      else { setAvailable(null) }
    }catch{ setAvailable(null) }
  }

  const validBasic = username.trim().length>=3 && password.length>=6 && password===confirm

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if(!validBasic){ setMsg('입력값을 확인하세요'); return }
    if(available === false){ setMsg('이미 사용 중인 아이디입니다'); return }
    try{
      setSubmitting(true)
      const body = new URLSearchParams({ username: username.trim(), password })
      const res = await fetch(`${getApiBase()}/auth/signup`, { method: 'POST', body })
      if(!res.ok){
        const t = await res.text();
        setMsg(t || '가입 실패');
        return
      }
      setMsg('가입 완료! 로그인 해주세요.')
    }catch{ setMsg('네트워크 오류') }
    finally{ setSubmitting(false) }
  }

  return (
    <main className="container" style={{maxWidth:480}}>
      <h1>회원가입</h1>
      <form onSubmit={onSubmit}>
        <div style={{marginBottom:8, display:'flex', gap:8, alignItems:'center'}}>
          <input placeholder="아이디(3자 이상)" value={username} onChange={e=>setUsername(e.target.value)} />
          <button type="button" onClick={checkDup}>중복확인</button>
          {available===true && <span style={{color:'green'}}>사용 가능</span>}
          {available===false && <span style={{color:'red'}}>이미 사용 중</span>}
        </div>
        <div style={{marginBottom:8}}>
          <input type="password" placeholder="비밀번호(6자 이상)" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <div style={{marginBottom:8}}>
          <input type="password" placeholder="비밀번호 확인" value={confirm} onChange={e=>setConfirm(e.target.value)} />
          {confirm && (password===confirm ? <span style={{color:'green', marginLeft:8}}>일치</span> : <span style={{color:'red', marginLeft:8}}>불일치</span>)}
        </div>
        <button type="submit" disabled={!validBasic || submitting}>가입</button>
      </form>
      {msg && <p style={{marginTop:8}}>{msg}</p>}
      <p><a href="/login">로그인으로</a></p>
    </main>
  )
}

