import { notFound } from "next/navigation";
import { AnalysisRoom } from "@/components/analysis-room";
import { getLiveSymbolProfile } from "@/lib/server/market-data";
import { formatCompactNumber, formatPrice } from "@/lib/server/utils";
import type { Market } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseMarket(value: string): Market | null {
  if (value.toLowerCase() === "kr") {
    return "KR";
  }

  if (value.toLowerCase() === "us") {
    return "US";
  }

  return null;
}

export default async function StockPage({
  params
}: {
  params: Promise<{ market: string; symbol: string }>;
}) {
  const { market: rawMarket, symbol } = await params;
  const market = parseMarket(rawMarket);
  if (!market) {
    notFound();
  }

  const profile = await getLiveSymbolProfile(market, symbol.toUpperCase());
  if (!profile) {
    notFound();
  }

  return (
    <div className="container page-stack">
      <section className="stock-hero">
        <div>
          <p className="eyebrow">종목 분석 페이지</p>
          <h1>
            {profile.name} <span className="ticker">{profile.symbol}</span>
          </h1>
          <div className="stock-meta">
            <span className="stat-card">
              <span className="timing-label">현재가</span>
              <strong>{formatPrice(profile.price, profile.currency)}</strong>
            </span>
            <span className="stat-card">
              <span className="timing-label">변동률</span>
              <strong className={profile.changePct >= 0 ? "up" : "down"}>
                {profile.changePct >= 0 ? "+" : ""}
                {profile.changePct.toFixed(2)}%
              </strong>
            </span>
            <span className="stat-card">
              <span className="timing-label">거래량</span>
              <strong>{formatCompactNumber(profile.volume)}</strong>
            </span>
            <span className="stat-card">
              <span className="timing-label">섹터</span>
              <strong>{profile.sector}</strong>
            </span>
          </div>
        </div>
        <div className="disclaimer-box">
          <strong>참고용 분석</strong>
          <p>
            이 페이지는 AI가 외부 데이터와 규칙 기반 요약을 바탕으로 만든 참고 자료입니다. 직접적인 투자 권유가
            아닙니다.
          </p>
        </div>
      </section>

      <AnalysisRoom market={profile.market} symbol={profile.symbol} symbolName={profile.name} />
    </div>
  );
}
