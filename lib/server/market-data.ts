import { symbolCatalog } from "@/lib/mock-data";
import {
  buildHomeMarketOverviewMap,
  buildTrackedMarketOverview,
  loadHomeStocksFromDb,
  loadTrackedStock
} from "@/lib/server/home-stocks";
import type { Market, MarketOverview, SymbolProfile } from "@/lib/types";

const globalCache = globalThis as typeof globalThis & {
  __marketSymbolInflight?: Map<string, Promise<SymbolProfile | null>>;
};

function getInflightCache() {
  if (!globalCache.__marketSymbolInflight) {
    globalCache.__marketSymbolInflight = new Map();
  }

  return globalCache.__marketSymbolInflight;
}

function toCacheKey(market: Market, symbol: string) {
  return `${market}:${symbol.toUpperCase()}`;
}

export async function getLiveSymbolProfile(
  market: Market,
  symbol: string
): Promise<SymbolProfile | null> {
  const cacheKey = toCacheKey(market, symbol);
  const inflight = getInflightCache();
  const pending = inflight.get(cacheKey);

  if (pending) {
    return pending;
  }

  const request = loadTrackedStock(market, symbol).finally(() => {
    inflight.delete(cacheKey);
  });

  inflight.set(cacheKey, request);
  return request;
}

export async function listLiveSymbolProfiles() {
  return loadHomeStocksFromDb();
}

export async function searchLiveSymbols(query: string) {
  const normalized = query.toLowerCase();
  const symbols = await listLiveSymbolProfiles();

  return symbols
    .filter((item) => {
      return (
        item.symbol.toLowerCase().includes(normalized) ||
        item.name.toLowerCase().includes(normalized) ||
        item.exchange.toLowerCase().includes(normalized)
      );
    })
    .slice(0, 8);
}

export async function buildMarketOverview(region: Market): Promise<MarketOverview> {
  const symbols = await loadHomeStocksFromDb({
    catalog: symbolCatalog.filter((item) => item.market === region)
  });

  return buildTrackedMarketOverview(region, symbols);
}

export async function buildMarketOverviewMap() {
  const stocks = await loadHomeStocksFromDb();
  return buildHomeMarketOverviewMap(stocks);
}
