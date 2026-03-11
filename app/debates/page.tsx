import { SessionCard } from "@/components/session-card";
import { listPopularSessions, listRecentSessions } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export default async function DebatesPage() {
  const [popular, recent] = await Promise.all([
    listPopularSessions(8),
    listRecentSessions(12)
  ]);

  return (
    <div className="container page-stack">
      <section className="page-intro">
        <p className="eyebrow">공개 게시판</p>
        <h1>다른 사용자가 만든 분석도 다시 볼 수 있습니다.</h1>
        <p className="hero-copy">
          로그인 없이 누구나 인기순과 최신순으로 AI 토론을 다시 읽고, 같은 종목을 새로 분석해 볼 수 있습니다.
        </p>
      </section>

      <section className="panel">
        <div className="panel-header compact">
          <div>
            <p className="eyebrow">인기순</p>
            <h2>많이 보는 토론</h2>
          </div>
        </div>
        <div className="card-grid">
          {popular.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header compact">
          <div>
            <p className="eyebrow">최신순</p>
            <h2>방금 생성된 토론</h2>
          </div>
        </div>
        <div className="card-grid">
          {recent.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      </section>
    </div>
  );
}
