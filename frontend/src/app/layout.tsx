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
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
