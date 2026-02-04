'use client'
import { useEffect, useState } from 'react'

export default function HeaderAuth() {
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    setToken(localStorage.getItem('token'))
  }, [])
  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('mustChangePassword')
    setToken(null)
    location.href = '/'
  }
  if (!token) {
    return <a href="/login">Login</a>
  }
  return (
    <>
      <a href="/admin" style={{ marginRight: 12 }}>Admin</a>
      <button onClick={logout}>Logout</button>
    </>
  )
}

