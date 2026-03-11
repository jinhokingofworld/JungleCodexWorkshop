import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { SessionCard } from "@/components/session-card";
import { marketOverviewCatalog, symbolCatalog } from "@/lib/mock-data";
import { prepareHomeData } from "@/lib/server/analysis-service";
import { formatCompactNumber, formatPrice, symbolPath } from "@/lib/server/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { popular, recent } = await prepareHomeData();

  return (
    <div className="container page-stack">
      <section className="hero">
        <div>
          <p className="eyebrow">공개형 주식 AI 토론</p>
          <h1>전문가들이 토론한 뒤, 읽기 쉬운 결론만 남깁니다.</h1>
          <p className="hero-copy">
            시장 요약을 보고, 종목을 선택하고, AI 전문가들의 토론을 천천히 읽은 뒤 최종 리포트와 가격 구간
            가이드를 확인하세요.
          </p>
          <SearchBox />
          <div className="hero-actions">
            <Link className="primary-button" href="/debates">
              공개 게시판 보기
            </Link>
            <Link className="secondary-button" href={symbolPath("KR", "005930")}>
              삼성전자 바로 분석
            </Link>
          </div>
        </div>
        <div className="hero-panel">
          <span className="mini-pill">오늘의 인기 분석</span>
          {popular.slice(0, 3).map((item) => (
            <Link className="mini-session" href={`/debates/${item.id}`} key={item.id}>
              <strong>
                {item.symbolName} · {item.symbol}
              </strong>
              <span>{item.overallView}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section-grid two-up">
        {(["KR", "US"] as const).map((region) => {
          const overview = marketOverviewCatalog[region];
          return (
            <section className="panel" key={region}>
              <div className="panel-header compact">
                <div>
                  <p className="eyebrow">{region === "KR" ? "한국 시장" : "미국 시장"}</p>
                  <h2>{region === "KR" ? "시장 대시보드" : "US Market Pulse"}</h2>
                </div>
              </div>
              <div className="index-grid">
                {overview.indices.map((item) => (
                  <article className="index-card" key={item.code}>
                    <span className="timing-label">{item.label}</span>
                    <strong>{item.value.toLocaleString("ko-KR")}</strong>
                    <span className={item.changePct >= 0 ? "up" : "down"}>
                      {item.changePct >= 0 ? "+" : ""}
                      {item.changePct.toFixed(2)}%
                    </span>
                  </article>
                ))}
              </div>
              <div className="signal-list">
                {overview.recentSignals.map((signal) => (
                  <p className="signal-item" key={signal}>
                    {signal}
                  </p>
                ))}
              </div>
            </section>
          );
        })}
      </section>

      <section className="section-grid two-up">
        <section className="panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">지금 많이 보는 분석</p>
              <h2>인기 토론</h2>
            </div>
            <Link className="text-link" href="/debates">
              전체 보기
            </Link>
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
              <p className="eyebrow">최근 공개 분석</p>
              <h2>방금 생성된 토론</h2>
            </div>
          </div>
          <div className="card-grid">
            {recent.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel-header compact">
          <div>
            <p className="eyebrow">인기 종목</p>
            <h2>바로 분석 시작</h2>
          </div>
        </div>
        <div className="symbol-grid">
          {symbolCatalog.map((symbol) => (
            <Link
              className="symbol-card"
              href={symbolPath(symbol.market, symbol.symbol)}
              key={`${symbol.market}-${symbol.symbol}`}
            >
              <div className="session-card-top">
                <span className="pill">{symbol.market}</span>
                <span className={symbol.changePct >= 0 ? "up" : "down"}>
                  {symbol.changePct >= 0 ? "+" : ""}
                  {symbol.changePct.toFixed(2)}%
                </span>
              </div>
              <strong>{symbol.name}</strong>
              <span className="muted">
                {symbol.symbol} · {symbol.exchange}
              </span>
              <div className="symbol-metrics">
                <span>{formatPrice(symbol.price, symbol.currency)}</span>
                <span>{formatCompactNumber(symbol.volume)} 거래</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
