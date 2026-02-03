import "./globals.css";
import type React from "react";

export const metadata = {
  title: "SGJO Shop",
  description: "Next.js + FastAPI + PostgreSQL on ACI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <div className="promo">오늘 가입하고 10% 할인 쿠폰 받기</div>
        <header className="site-header">
          <div className="container header-inner">
            <div className="brand">SGJO Shop</div>
            <nav className="nav">
              <a href="#products">Products</a>
              <a href={`${process.env.NEXT_PUBLIC_API_BASE}/health`} target="_blank">API</a>
            </nav>
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
