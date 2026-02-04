"use client"
import { useEffect, useState } from "react"

export default function HeaderAuth(){
  const [token, setToken] = useState<string|null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(()=>{
    const t = localStorage.getItem('token')
    setToken(t)
    if(t){
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${t}` }})
        .then(r=> r.ok ? r.json(): null)
        .then(j=> setIsAdmin(!!j?.is_admin))
        .catch(()=>{})
    }
  },[])
  const logout = () => {
    localStorage.clear()
    setToken(null)
    location.href = '/'
  }
  if(!token){
    return <a href="/login">???</a>
  }
  return (
    <>
      {isAdmin && <a href="/admin" style={{ marginRight: 12 }}>Admin</a>}
      <button onClick={logout}>????</button>
    </>
  )
}
