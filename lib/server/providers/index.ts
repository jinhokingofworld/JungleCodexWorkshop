import { findSymbol } from "@/lib/mock-data";
import type { EvidenceBundle, EvidenceItem, Market } from "@/lib/types";
import { fetchAlphaVantageEvidence } from "@/lib/server/providers/alpha-vantage";
import { fetchDartEvidence } from "@/lib/server/providers/dart";
import { fetchKisEvidence } from "@/lib/server/providers/kis";
import { fetchNaverNewsEvidence } from "@/lib/server/providers/naver";
import { logApiEvent } from "@/lib/server/logging";

function makeFallbackEvidence(market: Market, symbol: string): EvidenceItem[] {
  const profile = findSymbol(market, symbol);
  if (!profile) {
    return [];
  }

  const priceDirection = profile.changePct >= 0 ? "매수 유입" : "차익실현";
  const prefix = profile.market === "KR" ? "국내" : "해외";

  return [
    {
      id: `fallback-price-${profile.symbol.toLowerCase()}`,
      source: profile.market === "KR" ? "KIS" : "AlphaVantage",
      kind: "price",
      title: `${profile.name} ${prefix} 시세 스냅샷`,
      url: null,
      timestamp: new Date().toISOString(),
      snippet: `${priceDirection} 흐름 속에서 ${profile.price}${profile.currency === "KRW" ? "원" : "달러"} 부근이 핵심 가격대입니다.`,
      numericSnapshot: {
        price: profile.price,
        changePct: profile.changePct,
        volume: profile.volume
      }
    },
    {
      id: `fallback-news-${profile.symbol.toLowerCase()}`,
      source: "NAVER",
      kind: "news",
      title: `${profile.name} 관련 시장 반응`,
      url: null,
      timestamp: new Date().toISOString(),
      snippet: `${profile.sector} 업종 내 수급과 심리가 종목 변동성에 직접 연결되는 상황으로 정리됩니다.`
    },
    {
      id: `fallback-filing-${profile.symbol.toLowerCase()}`,
      source: profile.market === "KR" ? "DART" : "MockMacro",
      kind: profile.market === "KR" ? "filing" : "macro",
      title: profile.market === "KR" ? `${profile.name} 공시 체크포인트` : `${profile.name} 거시 체크포인트`,
      url: null,
      timestamp: new Date().toISOString(),
      snippet:
        profile.market === "KR"
          ? "최근 공시와 실적 가이던스 해석이 단기 방향성에 중요한 변수입니다."
          : "금리와 대형 기술주 밸류에이션이 동시 작용하는 구간입니다."
    }
  ];
}

export async function buildEvidenceBundle(
  market: Market,
  symbol: string
): Promise<EvidenceBundle> {
  const profile = findSymbol(market, symbol);
  if (!profile) {
    throw new Error(`Unknown symbol: ${market}/${symbol}`);
  }

  const [marketEvidence, newsEvidence, filingEvidence] = await Promise.all([
    market === "KR"
      ? fetchKisEvidence(profile)
      : fetchAlphaVantageEvidence(profile),
    fetchNaverNewsEvidence(profile),
    fetchDartEvidence(profile)
  ]);

  const liveEvidence = [marketEvidence, ...newsEvidence, ...filingEvidence].filter(
    Boolean
  ) as EvidenceItem[];

  if (liveEvidence.length > 0) {
    logApiEvent("evidence", "live_bundle", {
      market,
      symbol,
      count: liveEvidence.length,
      ids: liveEvidence.map((item) => item.id)
    });
  } else {
    logApiEvent(
      "evidence",
      "fallback_bundle",
      { market, symbol },
      "warn"
    );
  }

  return {
    symbol: profile,
    items: liveEvidence.length > 0 ? liveEvidence : makeFallbackEvidence(market, symbol)
  };
}
