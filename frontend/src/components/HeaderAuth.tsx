'use client'
import { useEffect, useState } from 'react'

export default function HeaderAuth() {
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => { setToken(localStorage.getItem('token')) }, [])
  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('mustChangePassword')
    setToken(null)
    location.href = '/'
  }
  if (!token) {
    return <a href="/login">로그인</a>
  }
  return (
    <>
      <a href="/admin" style={{ marginRight: 12 }}>관리자</a>
      <button onClick={logout}>로그아웃</button>
    </>
  )
}
