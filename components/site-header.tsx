import Link from "next/link";
import { appConfig } from "@/lib/server/config";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container nav-shell">
        <Link className="brand" href="/">
          <span className="brand-badge">AI</span>
          <span>{appConfig.appName}</span>
        </Link>
        <nav className="nav-links">
          <Link href="/">홈</Link>
          <Link href="/debates">공개 게시판</Link>
        </nav>
      </div>
    </header>
  );
}
