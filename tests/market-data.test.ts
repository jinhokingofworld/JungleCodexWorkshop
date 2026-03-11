import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketOverview, SymbolProfile } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  buildHomeMarketOverviewMap: vi.fn(),
  buildTrackedMarketOverview: vi.fn(),
  loadHomeStocksFromDb: vi.fn(),
  loadTrackedStock: vi.fn()
}));

vi.mock("@/lib/server/home-stocks", () => ({
  buildHomeMarketOverviewMap: mocks.buildHomeMarketOverviewMap,
  buildTrackedMarketOverview: mocks.buildTrackedMarketOverview,
  loadHomeStocksFromDb: mocks.loadHomeStocksFromDb,
  loadTrackedStock: mocks.loadTrackedStock
}));

import {
  buildMarketOverview,
  buildMarketOverviewMap,
  getLiveSymbolProfile,
  searchLiveSymbols
} from "@/lib/server/market-data";

function makeProfile(overrides: Partial<SymbolProfile> = {}): SymbolProfile {
  return {
    market: "US",
    symbol: "NVDA",
    name: "NVIDIA",
    exchange: "NASDAQ",
    sector: "Semiconductor",
    currency: "USD",
    price: 100,
    changePct: 1.5,
    volume: 1000,
    ...overrides
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("market data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (
      globalThis as typeof globalThis & {
        __marketSymbolInflight?: Map<string, Promise<SymbolProfile | null>>;
      }
    ).__marketSymbolInflight;
  });

  it("dedupes concurrent single-stock requests while delegating to the tracked stock loader", async () => {
    const profile = makeProfile({ price: 410 });
    const deferred = createDeferred<SymbolProfile | null>();
    mocks.loadTrackedStock.mockReturnValueOnce(deferred.promise);

    const first = getLiveSymbolProfile("US", "nvda");
    const second = getLiveSymbolProfile("US", "NVDA");

    expect(mocks.loadTrackedStock).toHaveBeenCalledTimes(1);
    expect(mocks.loadTrackedStock).toHaveBeenCalledWith("US", "nvda");

    deferred.resolve(profile);

    await expect(Promise.all([first, second])).resolves.toEqual([profile, profile]);
  });

  it("uses the shared tracked stocks loader for symbol search", async () => {
    const symbols = [
      makeProfile(),
      makeProfile({ symbol: "TSLA", name: "Tesla", price: 230 })
    ];
    mocks.loadHomeStocksFromDb.mockResolvedValueOnce(symbols);

    await expect(searchLiveSymbols("tes")).resolves.toEqual([symbols[1]]);
    expect(mocks.loadHomeStocksFromDb).toHaveBeenCalledWith();
  });

  it("builds region overviews from the shared tracked stocks loader", async () => {
    const stocks = [makeProfile(), makeProfile({ market: "US", symbol: "AAPL", name: "Apple" })];
    const overview = {
      region: "US",
      indices: [],
      movers: stocks,
      activeSymbols: stocks,
      recentSignals: []
    } satisfies MarketOverview;

    mocks.loadHomeStocksFromDb.mockResolvedValueOnce(stocks);
    mocks.buildTrackedMarketOverview.mockReturnValueOnce(overview);

    await expect(buildMarketOverview("US")).resolves.toBe(overview);
    expect(mocks.loadHomeStocksFromDb).toHaveBeenCalledTimes(1);
    expect(mocks.buildTrackedMarketOverview).toHaveBeenCalledWith("US", stocks);

    const call = mocks.loadHomeStocksFromDb.mock.calls[0]?.[0];
    expect(call?.catalog).toBeDefined();
    expect(call?.catalog.every((item: SymbolProfile) => item.market === "US")).toBe(true);
  });

  it("reuses the shared tracked stocks loader when building both overview maps", async () => {
    const stocks = [makeProfile({ market: "KR", symbol: "005930", name: "삼성전자" }), makeProfile()];
    const overviewMap = {
      KR: {
        region: "KR",
        indices: [],
        movers: [],
        activeSymbols: [],
        recentSignals: []
      },
      US: {
        region: "US",
        indices: [],
        movers: [],
        activeSymbols: [],
        recentSignals: []
      }
    } as const;

    mocks.loadHomeStocksFromDb.mockResolvedValueOnce(stocks);
    mocks.buildHomeMarketOverviewMap.mockReturnValueOnce(overviewMap);

    await expect(buildMarketOverviewMap()).resolves.toBe(overviewMap);
    expect(mocks.loadHomeStocksFromDb).toHaveBeenCalledWith();
    expect(mocks.buildHomeMarketOverviewMap).toHaveBeenCalledWith(stocks);
  });
});
