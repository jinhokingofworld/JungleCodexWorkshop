import { symbolCatalog } from "@/lib/mock-data";
import { logApiEvent } from "@/lib/server/logging";
import { fetchKisEvidence } from "@/lib/server/providers/kis";
import { fetchTwelveDataEvidence } from "@/lib/server/providers/twelve-data";
import {
  fromStockDocument,
  getStocksRepository,
  isStockFresh,
  toStockDocument,
  type StocksRepository
} from "@/lib/server/stocks-repository";
import type { Market, MarketOverview, SymbolProfile } from "@/lib/types";

export interface TrackedStocksLoaderOptions {
  catalog?: SymbolProfile[];
  now?: Date;
  repository?: StocksRepository | null;
  refreshStock?: (profile: SymbolProfile) => Promise<SymbolProfile | null>;
}

function findTrackedSymbolProfile(
  market: Market,
  symbol: string,
  catalog: SymbolProfile[]
) {
  return (
    catalog.find(
      (item) =>
        item.market === market &&
        item.symbol.toLowerCase() === symbol.trim().toLowerCase()
    ) ?? null
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

export async function fetchHomeStockSnapshot(
  profile: SymbolProfile
): Promise<SymbolProfile | null> {
  const evidence =
    profile.market === "KR"
      ? await fetchKisEvidence(profile)
      : await fetchTwelveDataEvidence(profile);

  if (!evidence?.numericSnapshot) {
    logApiEvent(
      "home-stocks",
      "refresh_fallback",
      { market: profile.market, symbol: profile.symbol },
      "warn"
    );
    return null;
  }

  const refreshed = mergeNumericSnapshot(profile, evidence.numericSnapshot);
  logApiEvent("home-stocks", "refresh_success", {
    market: refreshed.market,
    symbol: refreshed.symbol,
    source: evidence.source,
    price: refreshed.price,
    changePct: refreshed.changePct
  });
  return refreshed;
}

async function loadSingleTrackedStock(
  profile: SymbolProfile,
  repository: StocksRepository | null,
  now: Date,
  refreshStock: (profile: SymbolProfile) => Promise<SymbolProfile | null>
) {
  const persisted = repository
    ? await repository.findStock(profile.symbol, profile.market)
    : null;

  if (persisted && isStockFresh(persisted.create_at, now)) {
    logApiEvent("home-stocks", "db_hit", {
      market: profile.market,
      symbol: profile.symbol,
      createAt: new Date(persisted.create_at).toISOString()
    });
    return fromStockDocument(profile, persisted);
  }

  const refreshed = await refreshStock(profile);
  if (refreshed) {
    const refreshedDocument = toStockDocument(refreshed, now);
    const stored = repository
      ? await repository.upsertStock(refreshedDocument)
      : refreshedDocument;

    return fromStockDocument(profile, stored);
  }

  if (persisted) {
    logApiEvent("home-stocks", "stale_db_reused", {
      market: profile.market,
      symbol: profile.symbol,
      createAt: new Date(persisted.create_at).toISOString()
    });
    return fromStockDocument(profile, persisted);
  }

  const fallbackDocument = toStockDocument(profile, now);
  const stored = repository
    ? await repository.upsertStock(fallbackDocument)
    : fallbackDocument;

  logApiEvent("home-stocks", "seeded_from_catalog", {
    market: profile.market,
    symbol: profile.symbol
  });
  return fromStockDocument(profile, stored);
}

export async function loadHomeStocksFromDb(
  options: TrackedStocksLoaderOptions = {}
) {
  const catalog = options.catalog ?? symbolCatalog;
  const now = options.now ?? new Date();
  const repository =
    options.repository === undefined ? getStocksRepository() : options.repository;
  const refreshStock = options.refreshStock ?? fetchHomeStockSnapshot;

  return Promise.all(
    catalog.map((profile) => loadSingleTrackedStock(profile, repository, now, refreshStock))
  );
}

export async function loadTrackedStock(
  market: Market,
  symbol: string,
  options: TrackedStocksLoaderOptions = {}
) {
  const catalog = options.catalog ?? symbolCatalog;
  const profile = findTrackedSymbolProfile(market, symbol, catalog);

  if (!profile) {
    return null;
  }

  const now = options.now ?? new Date();
  const repository =
    options.repository === undefined ? getStocksRepository() : options.repository;
  const refreshStock = options.refreshStock ?? fetchHomeStockSnapshot;

  return loadSingleTrackedStock(profile, repository, now, refreshStock);
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

export function buildTrackedMarketOverview(
  region: Market,
  stocks: SymbolProfile[]
): MarketOverview {
  const symbols = stocks.filter((item) => item.market === region);
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

  return {
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
}

export function buildHomeMarketOverviewMap(stocks: SymbolProfile[]) {
  return {
    KR: buildTrackedMarketOverview("KR", stocks),
    US: buildTrackedMarketOverview("US", stocks)
  } as const;
}
