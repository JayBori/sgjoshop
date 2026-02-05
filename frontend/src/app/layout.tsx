import "./globals.css";
import type React from "react";
import Script from "next/script";
import HeaderAuth from "../components/HeaderAuth";
import { getApiBase } from "../lib/getApiBase";

export async function generateMetadata() {
  try {
    const res = await fetch(`${getApiBase()}/settings/public`, { cache: 'no-store' });
    const s = res.ok ? await res.json() : ({} as any);
    return {
      title: s.title || 'SGJO Shop',
      description: s.description || 'Next.js + FastAPI on ACI',
      openGraph: {
        title: s.title || 'SGJO Shop',
        description: s.description || 'Next.js + FastAPI on ACI',
        url: (typeof process !== 'undefined' ? process.env.FRONT_DOMAIN : undefined) || '',
        images: s.ogImage ? [{ url: s.ogImage }] : [],
        siteName: 'SGJO Shop',
        locale: 'ko_KR',
        type: 'website',
      },
    };
  } catch {
    return { title: 'SGJO Shop', description: 'Next.js + FastAPI on ACI' };
  }
}

async function getPublicSettings() {
  const res = await fetch(`${getApiBase()}/settings/public`, { cache: 'no-store' });
  if (!res.ok) return {} as any;
  return res.json();
}
async function getCategories() {
  const res = await fetch(`${getApiBase()}/categories`, { cache: 'no-store' });
  if (!res.ok) return [] as any[];
  return res.json();
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getPublicSettings(), getCategories()]);
  return (
    <html lang="ko">
      <body>
        {settings.promoText && <div className="promo">{settings.promoText}</div>}
        <header className="site-header">
          <div className="container header-inner">
            <div className="brand"><a href="/">SGJO Shop</a></div>
            <nav className="nav" style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
              <a href="#products">🛍️ Products</a>
              <a href="/cart">🛒 Cart</a>
              <details>
                <summary>📂 카테고리</summary>
                <div style={{ position:'absolute', background:'#fff', border:'1px solid #eee', padding:8, borderRadius:8 }}>
                  {categories?.map((c:any) => (
                    <div key={c.id}><a href={`/category/${c.slug}`}>{c.name}</a></div>
                  ))}
                </div>
              </details>
              <a href={`${process.env.NEXT_PUBLIC_API_BASE||''}/health`} target="_blank">🔗 API</a>
            </nav>
            <div className="auth"><HeaderAuth /></div>
            <Script src="/runtime-config.js" strategy="beforeInteractive" />
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="container">© {new Date().getFullYear()} {settings.footerText || 'SGJO Shop'}</div>
        </footer>
      </body>
    </html>
  );
}
