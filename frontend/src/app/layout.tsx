import "./globals.css";
import type React from "react";
import Script from "next/script";
import HeaderAuth from "../components/HeaderAuth";

export const metadata = {
  title: "SGJO Shop",
  description: "Next.js + FastAPI + PostgreSQL on ACI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="promo">특가 세일! 첫 구매 10% 할인</div>
        <header className="site-header">
          <div className="container header-inner">
            <div className="brand">SGJO Shop</div>
            <nav className="nav">
              <a href="#products">Products</a>
              <a href={`${process.env.NEXT_PUBLIC_API_BASE}/health`} target="_blank">API</a>
            </nav>
            <div className="auth"><HeaderAuth /></div>
            <Script src="/runtime-config.js" strategy="beforeInteractive" />
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="container">© {new Date().getFullYear()} SGJO Shop</div>
        </footer>
      </body>
    </html>
  );
}
