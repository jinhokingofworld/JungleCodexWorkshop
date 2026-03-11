import { symbolCatalog } from "@/lib/mock-data";
import { fetchAlphaVantageEvidence } from "@/lib/server/providers/alpha-vantage";
import { fetchKisEvidence } from "@/lib/server/providers/kis";
import { logApiEvent } from "@/lib/server/logging";
import type { Market, MarketOverview, SymbolProfile } from "@/lib/types";

const SYMBOL_CACHE_TTL_MS = 60_000;
const FALLBACK_CACHE_TTL_MS = 5_000;

interface CachedValue<T> {
  expiresAt: number;
  value: T;
}

const globalCache = globalThis as typeof globalThis & {
  __marketSymbolCache?: Map<string, CachedValue<SymbolProfile>>;
  __marketOverviewCache?: Map<Market, CachedValue<MarketOverview>>;
  __marketSymbolInflight?: Map<string, Promise<SymbolProfile | null>>;
};

function getSymbolCache() {
  if (!globalCache.__marketSymbolCache) {
    globalCache.__marketSymbolCache = new Map();
  }

  return globalCache.__marketSymbolCache;
}

function getOverviewCache() {
  if (!globalCache.__marketOverviewCache) {
    globalCache.__marketOverviewCache = new Map();
  }

  return globalCache.__marketOverviewCache;
}

function getInflightCache() {
  if (!globalCache.__marketSymbolInflight) {
    globalCache.__marketSymbolInflight = new Map();
  }

  return globalCache.__marketSymbolInflight;
}

function toCacheKey(market: Market, symbol: string) {
  return `${market}:${symbol.toUpperCase()}`;
}

function isFresh<T>(entry: CachedValue<T> | undefined) {
  return Boolean(entry && entry.expiresAt > Date.now());
}

function getBaseSymbolProfile(market: Market, symbol: string) {
  return symbolCatalog.find(
    (item) =>
      item.market === market && item.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

function mergeNumericSnapshot(profile: SymbolProfile, snapshot?: Record<string, number | string>) {
  if (!snapshot) {
    return profile;
  }

  return {
    ...profile,
    price:
      typeof snapshot.price === "number" && Number.isFinite(snapshot.price)
        ? snapshot.price
        : profile.price,
    changePct:
      typeof snapshot.changePct === "number" && Number.isFinite(snapshot.changePct)
        ? snapshot.changePct
        : profile.changePct,
    volume:
      typeof snapshot.volume === "number" && Number.isFinite(snapshot.volume)
        ? snapshot.volume
        : profile.volume
  };
}

function buildSignals(region: Market, movers: SymbolProfile[], activeSymbols: SymbolProfile[]) {
  const leader = movers[0];
  const volumeLeader = activeSymbols[0];
  const gainers = activeSymbols.filter((item) => item.changePct >= 0).length;
  const losers = Math.max(activeSymbols.length - gainers, 0);

  return [
    leader
      ? `${leader.name}가 ${leader.changePct >= 0 ? "+" : ""}${leader.changePct.toFixed(2)}%로 ${
          region === "KR" ? "국내" : "미국"
        } 추적 종목 중 변동성이 가장 큽니다.`
      : `${region === "KR" ? "국내" : "미국"} 추적 종목 데이터가 아직 준비되지 않았습니다.`,
    volumeLeader
      ? `${volumeLeader.name} 거래량이 ${volumeLeader.market === "KR" ? "국내" : "해외"} 추적 종목 중 가장 큽니다.`
      : "거래량 리더를 계산할 데이터가 없습니다.",
    `${region === "KR" ? "국내" : "미국"} 추적 종목 기준 상승 ${gainers}개, 하락 ${losers}개입니다.`
  ];
}

async function resolveLiveSymbolProfile(profile: SymbolProfile) {
  const evidence =
    profile.market === "KR"
      ? await fetchKisEvidence(profile)
      : await fetchAlphaVantageEvidence(profile);

  if (!evidence?.numericSnapshot) {
    logApiEvent(
      "market-data",
      "symbol_profile_fallback",
      { market: profile.market, symbol: profile.symbol },
      "warn"
    );
    return profile;
  }

  const liveProfile = mergeNumericSnapshot(profile, evidence.numericSnapshot);
  logApiEvent("market-data", "symbol_profile_live", {
    market: liveProfile.market,
    symbol: liveProfile.symbol,
    source: evidence.source,
    price: liveProfile.price,
    changePct: liveProfile.changePct
  });
  return liveProfile;
}

export async function getLiveSymbolProfile(
  market: Market,
  symbol: string
): Promise<SymbolProfile | null> {
  const cacheKey = toCacheKey(market, symbol);
  const cache = getSymbolCache();
  const cached = cache.get(cacheKey);
  if (isFresh(cached)) {
    return cached?.value ?? null;
  }

  const inflight = getInflightCache();
  const pending = inflight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const baseProfile = getBaseSymbolProfile(market, symbol);
  if (!baseProfile) {
    return null;
  }

  const request = resolveLiveSymbolProfile(baseProfile)
    .then((profile) => {
      cache.set(cacheKey, {
        expiresAt:
          profile === baseProfile
            ? Date.now() + FALLBACK_CACHE_TTL_MS
            : Date.now() + SYMBOL_CACHE_TTL_MS,
        value: profile
      });
      return profile;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });

  inflight.set(cacheKey, request);
  return request;
}

export async function listLiveSymbolProfiles() {
  return Promise.all(
    symbolCatalog.map((profile) => getLiveSymbolProfile(profile.market, profile.symbol))
  ).then((items) => items.filter(Boolean) as SymbolProfile[]);
}

export async function searchLiveSymbols(query: string) {
  const symbols = await listLiveSymbolProfiles();
  return symbols
    .filter((item) => {
      const normalized = query.toLowerCase();
      return (
        item.symbol.toLowerCase().includes(normalized) ||
        item.name.toLowerCase().includes(normalized) ||
        item.exchange.toLowerCase().includes(normalized)
      );
    })
    .slice(0, 8);
}

export async function buildMarketOverview(region: Market): Promise<MarketOverview> {
  const cache = getOverviewCache();
  const cached = cache.get(region);
  if (cached && isFresh(cached)) {
    return cached.value;
  }

  const symbols = (await listLiveSymbolProfiles()).filter((item) => item.market === region);
  const movers = [...symbols]
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 3);
  const activeSymbols = [...symbols].sort((a, b) => b.volume - a.volume).slice(0, 4);
  const avgChange =
    symbols.length > 0
      ? symbols.reduce((sum, item) => sum + item.changePct, 0) / symbols.length
      : 0;
  const gainers = symbols.filter((item) => item.changePct >= 0).length;
  const volumeLeader = activeSymbols[0];

  const overview: MarketOverview = {
    region,
    indices: [
      {
        code: `${region}-avg-change`,
        label: "평균 등락률",
        value: Number(avgChange.toFixed(2)),
        changePct: avgChange
      },
      {
        code: `${region}-gainers`,
        label: "상승 종목 수",
        value: gainers,
        changePct: symbols.length > 0 ? (gainers / symbols.length) * 100 - 50 : 0
      },
      {
        code: `${region}-volume-leader`,
        label: "거래량 리더",
        value: volumeLeader?.volume ?? 0,
        changePct: volumeLeader?.changePct ?? 0
      }
    ],
    movers,
    activeSymbols,
    recentSignals: buildSignals(region, movers, activeSymbols)
  };

  cache.set(region, {
    expiresAt: Date.now() + SYMBOL_CACHE_TTL_MS,
    value: overview
  });

  return overview;
}

export async function buildMarketOverviewMap() {
  const [krOverview, usOverview] = await Promise.all([
    buildMarketOverview("KR"),
    buildMarketOverview("US")
  ]);

  return {
    KR: krOverview,
    US: usOverview
  } as const;
}
