import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Room",
  description: "AI 전문가 토론으로 보는 공개형 주식 분석 서비스"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <SiteHeader />
        <main className="page-shell">{children}</main>
      </body>
    </html>
  );
}
