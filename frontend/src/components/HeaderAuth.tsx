"use client"
import { useEffect, useState } from "react"

export default function HeaderAuth(){
  const [token, setToken] = useState<string|null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [username, setUsername] = useState<string>('')
  useEffect(()=>{
    const t = localStorage.getItem('token')
    setToken(t)
    if(t){
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` }})
        .then(r=> r.ok ? r.json(): null)
        .then(j=> { setIsAdmin(!!j?.is_admin); setUsername(j?.username||'') })
        .catch(()=>{})
    }
  },[])
  const logout = () => {
    localStorage.clear()
    setToken(null)
    location.href = '/'
  }
  if(!token){
    return <a href="/login">로그인</a>
  }
  return (
    <>
      <a href="/mypage" style={{ marginRight: 12 }}>👤 {username||'마이'}</a>
      {isAdmin && <a href="/admin" style={{ marginRight: 12 }}>Admin</a>}
      <button onClick={logout}>로그아웃</button>
    </>
  )
}
