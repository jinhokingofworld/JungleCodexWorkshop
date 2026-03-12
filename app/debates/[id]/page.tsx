import Link from "next/link";
import { notFound } from "next/navigation";
import { DebateLikeButton } from "@/components/debate-like-button";
import { AnalysisRoom } from "@/components/analysis-room";
import { getAnalysisSession } from "@/lib/server/analysis-service";
import { symbolPath } from "@/lib/server/utils";

export const dynamic = "force-dynamic";

export default async function DebateDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const { id } = await params;
    const session = await getAnalysisSession(id);

    return (
      <div className="container page-stack">
        <section className="page-intro page-intro-card">
          <div>
            <p className="eyebrow">공개 분석 다시보기</p>
            <h1>
              {session.symbolName} · {session.symbol}
            </h1>
            <p className="hero-copy">{session.finalReport.overallView}</p>
            <div className="detail-like-row">
              <span className="muted">{session.likes} likes</span>
              <DebateLikeButton debateId={session.id} initialLikes={session.likes} />
            </div>
          </div>
          <Link className="secondary-button" href={symbolPath(session.market, session.symbol)}>
            같은 종목 분석
          </Link>
        </section>

        <AnalysisRoom
          initialSession={session}
          market={session.market}
          symbol={session.symbol}
          symbolName={session.symbolName}
        />
      </div>
    );
  } catch {
    notFound();
  }
}
