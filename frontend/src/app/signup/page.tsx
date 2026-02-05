'use client'
import { useEffect, useState } from 'react'
import { getApiBase } from "../../lib/getApiBase"

export default function SignupPage(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fullName, setFullName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [zipcode, setZipcode] = useState('')
  const [address, setAddress] = useState('')
  const [address2, setAddress2] = useState('')
  const [available, setAvailable] = useState<boolean|null>(null)
  const [msg, setMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(()=>{ setMsg('') }, [username, password, confirm, fullName, birthdate, email, phone, zipcode, address, address2])

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
    if(available === false){ setMsg('이미 사용중인 아이디입니다'); return }
    try{
      setSubmitting(true)
      const body = new URLSearchParams({
        username: username.trim(), password,
        full_name: fullName, birthdate, email, phone, zipcode, address, address2
      } as any)
      const res = await fetch(`${getApiBase()}/auth/signup`, { method: 'POST', body })
      if(!res.ok){
        const t = await res.text(); setMsg(t || '가입 실패'); return
      }
      setMsg('가입 완료! 로그인 해주세요.')
    }catch{ setMsg('네트워크 오류') }
    finally{ setSubmitting(false) }
  }

  return (
    <main className="container" style={{maxWidth:640}}>
      <h1>회원가입</h1>
      <form onSubmit={onSubmit}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <input placeholder="아이디(3자 이상)" value={username} onChange={e=>setUsername(e.target.value)} />
          <button type="button" onClick={checkDup}>중복확인</button>
          <input type="password" placeholder="비밀번호(6자 이상)" value={password} onChange={e=>setPassword(e.target.value)} />
          <input type="password" placeholder="비밀번호 확인" value={confirm} onChange={e=>setConfirm(e.target.value)} />
          <input placeholder="이름" value={fullName} onChange={e=>setFullName(e.target.value)} />
          <input placeholder="생년월일(YYYY-MM-DD)" value={birthdate} onChange={e=>setBirthdate(e.target.value)} />
          <input placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)} />
          <input placeholder="휴대폰" value={phone} onChange={e=>setPhone(e.target.value)} />
          <input placeholder="우편번호" value={zipcode} onChange={e=>setZipcode(e.target.value)} />
          <input placeholder="주소" value={address} onChange={e=>setAddress(e.target.value)} />
          <input placeholder="상세주소" value={address2} onChange={e=>setAddress2(e.target.value)} />
        </div>
        <button type="submit" disabled={!validBasic || submitting} style={{marginTop:8}}>가입</button>
      </form>
      {msg && <p style={{marginTop:8}}>{msg}</p>}
      <p><a href="/login">로그인</a></p>
    </main>
  )
}
