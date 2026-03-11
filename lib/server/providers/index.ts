import { findSymbol } from "@/lib/mock-data";
import type { EvidenceBundle, EvidenceItem, Market } from "@/lib/types";
import { fetchDartEvidence } from "@/lib/server/providers/dart";
import { fetchKisEvidence } from "@/lib/server/providers/kis";
import { fetchNaverNewsEvidence } from "@/lib/server/providers/naver";
import { fetchTwelveDataEvidence } from "@/lib/server/providers/twelve-data";
import { logApiEvent } from "@/lib/server/logging";

function getFallbackSourceUrl(market: Market, symbol: string, symbolName: string, source: EvidenceItem["source"]) {
  switch (source) {
    case "KIS":
      return "https://apiportal.koreainvestment.com/";
    case "TwelveData":
      return `https://twelvedata.com/symbols/${encodeURIComponent(symbol)}`;
    case "NAVER":
      return market === "KR"
        ? `https://finance.naver.com/item/main.naver?code=${encodeURIComponent(symbol)}`
        : `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(`${symbolName} ${symbol} 주식`)}`;
    case "DART":
      return "https://opendart.fss.or.kr/";
    case "MockMacro":
      return "https://fred.stlouisfed.org/";
    default:
      return null;
  }
}

function mergeLiveMarketSnapshot(
  profile: ReturnType<typeof findSymbol>,
  marketEvidence: EvidenceItem | null
) {
  if (!profile || !marketEvidence?.numericSnapshot) {
    return profile;
  }

  return {
    ...profile,
    price:
      typeof marketEvidence.numericSnapshot.price === "number"
        ? marketEvidence.numericSnapshot.price
        : profile.price,
    changePct:
      typeof marketEvidence.numericSnapshot.changePct === "number"
        ? marketEvidence.numericSnapshot.changePct
        : profile.changePct,
    volume:
      typeof marketEvidence.numericSnapshot.volume === "number"
        ? marketEvidence.numericSnapshot.volume
        : profile.volume
  };
}

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
      source: profile.market === "KR" ? "KIS" : "TwelveData",
      kind: "price",
      title: `${profile.name} ${prefix} 시세 스냅샷`,
      url: getFallbackSourceUrl(
        profile.market,
        profile.symbol,
        profile.name,
        profile.market === "KR" ? "KIS" : "TwelveData"
      ),
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
      url: getFallbackSourceUrl(profile.market, profile.symbol, profile.name, "NAVER"),
      timestamp: new Date().toISOString(),
      snippet: `${profile.sector} 업종 내 수급과 심리가 종목 변동성에 직접 연결되는 상황으로 정리됩니다.`
    },
    {
      id: `fallback-filing-${profile.symbol.toLowerCase()}`,
      source: profile.market === "KR" ? "DART" : "MockMacro",
      kind: profile.market === "KR" ? "filing" : "macro",
      title: profile.market === "KR" ? `${profile.name} 공시 체크포인트` : `${profile.name} 거시 체크포인트`,
      url: getFallbackSourceUrl(
        profile.market,
        profile.symbol,
        profile.name,
        profile.market === "KR" ? "DART" : "MockMacro"
      ),
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
      : fetchTwelveDataEvidence(profile),
    fetchNaverNewsEvidence(profile),
    fetchDartEvidence(profile)
  ]);

  const liveEvidence = [marketEvidence, ...newsEvidence, ...filingEvidence].filter(
    Boolean
  ) as EvidenceItem[];
  const resolvedProfile = mergeLiveMarketSnapshot(profile, marketEvidence);

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
    symbol: resolvedProfile ?? profile,
    items: liveEvidence.length > 0 ? liveEvidence : makeFallbackEvidence(market, symbol)
  };
}
