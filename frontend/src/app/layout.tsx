import "./globals.css";
import type React from "react";
import Script from "next/script";
import HeaderAuth from "../components/HeaderAuth";
import { getApiBase } from "../lib/getApiBase";

export const metadata = {
  title: "SGJO Shop",
  description: "Next.js + FastAPI on ACI",
};

async function getPublicSettings(){
  const res = await fetch(`${getApiBase()}/settings/public`, { cache: 'no-store' });
  if(!res.ok) return {} as any; return res.json();
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicSettings();
  return (
    <html lang="ko">
      <body>
        {settings.promoText && <div className="promo">{settings.promoText}</div>}
        <header className="site-header">
          <div className="container header-inner">
            <div className="brand"><a href="/">SGJO Shop</a></div>
            <nav className="nav">
              <a href="#products">Products</a>
              <a href="/cart">Cart</a>
              <a href={`${process.env.NEXT_PUBLIC_API_BASE||''}/health`} target="_blank">API</a>
            </nav>
            <div className="auth"><HeaderAuth /></div>
            <Script src="/runtime-config.js" strategy="beforeInteractive" />
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="container">© {new Date().getFullYear()} {settings.footerText||'SGJO Shop'}</div>
        </footer>
      </body>
    </html>
  );
}
