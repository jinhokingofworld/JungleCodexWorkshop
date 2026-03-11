import Link from "next/link";
import type { SessionPreview } from "@/lib/types";
import { symbolPath } from "@/lib/server/utils";

interface SessionCardProps {
  session: SessionPreview;
}

export function SessionCard({ session }: SessionCardProps) {
  return (
    <article className="session-card">
      <div className="session-card-top">
        <span className="pill">{session.market}</span>
        <span className="muted">
          {new Date(session.createdAt).toLocaleString("ko-KR", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })}
        </span>
      </div>
      <h3>
        {session.symbolName} <span className="ticker">{session.symbol}</span>
      </h3>
      <p className="session-summary">{session.overallView}</p>
      <p className="session-timing">{session.summary}</p>
      <div className="tag-row">
        {session.watchword.map((item) => (
          <span className="tag" key={item}>
            {item}
          </span>
        ))}
      </div>
      <div className="session-card-actions">
        <Link className="ghost-button" href={`/debates/${session.id}`}>
          토론 다시보기
        </Link>
        <Link className="ghost-button" href={symbolPath(session.market, session.symbol)}>
          새 분석
        </Link>
      </div>
    </article>
  );
}
