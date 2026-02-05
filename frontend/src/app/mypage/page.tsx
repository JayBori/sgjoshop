"use client";
import { useEffect, useState } from 'react';
import { getApiBase } from '../../lib/getApiBase';

export default function MyPage(){
  const [token, setToken] = useState<string|null>(null);
  const [message, setMessage] = useState('');

  useEffect(()=>{
    const t = localStorage.getItem('token');
    if(!t){ location.href = '/login'; return }
    setToken(t);
  },[]);

  async function onChangePassword(e: React.FormEvent){
    e.preventDefault();
    if(!token) return;
    const form = e.currentTarget as HTMLFormElement;
    const pw = (form.elements.namedItem('new_password') as HTMLInputElement).value;
    const body = new URLSearchParams({ new_password: pw });
    const r = await fetch(`${getApiBase()}/auth/change-password`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body });
    setMessage(r.ok ? '비밀번호가 변경되었습니다' : '비밀번호 변경 실패');
    form.reset();
  }

  return (
    <main className="container" style={{maxWidth:480}}>
      <h1>마이페이지</h1>
      <section style={{marginTop:16}}>
        <h2>비밀번호 변경</h2>
        <form onSubmit={onChangePassword}>
          <input type="password" name="new_password" placeholder="새 비밀번호(6자 이상)" />
          <button type="submit">변경</button>
        </form>
        {message && <p style={{marginTop:8}}>{message}</p>}
      </section>
    </main>
  );
}
