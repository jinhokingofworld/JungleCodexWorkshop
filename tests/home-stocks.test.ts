import { describe, expect, it, vi } from "vitest";
import { buildStockObjectId, toStockDocument, type StocksRepository } from "@/lib/server/stocks-repository";
import { loadHomeStocksFromDb, loadTrackedStock } from "@/lib/server/home-stocks";
import type { Market, SymbolProfile } from "@/lib/types";

class FakeStocksRepository implements StocksRepository {
  private store = new Map<string, ReturnType<typeof toStockDocument>>();

  constructor(initial: ReturnType<typeof toStockDocument>[] = []) {
    initial.forEach((document) => {
      this.store.set(document._id, document);
    });
  }

  async findStock(ticker: string, nation: Market) {
    return this.store.get(buildStockObjectId(nation, ticker)) ?? null;
  }

  async upsertStock(stockDoc: ReturnType<typeof toStockDocument>) {
    this.store.set(stockDoc._id, stockDoc);
    return this.store.get(stockDoc._id) ?? stockDoc;
  }
}

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

describe("home stocks loader", () => {
  it("inserts a fresh API value when the stock document is missing", async () => {
    const repository = new FakeStocksRepository();
    const refreshStock = vi.fn(async (profile: SymbolProfile) => ({
      ...profile,
      price: 125,
      changePct: 4.2,
      volume: 2400
    }));

    const [stock] = await loadHomeStocksFromDb({
      catalog: [makeProfile()],
      now: new Date("2026-03-11T12:00:00.000Z"),
      repository,
      refreshStock
    });

    expect(stock.price).toBe(125);
    expect(refreshStock).toHaveBeenCalledTimes(1);
    expect(await repository.findStock("NVDA", "US")).toMatchObject({
      _id: "US:NVDA",
      object_id: "US:NVDA",
      ticker: "NVDA",
      price: 125,
      fluctuation_rate: 4.2,
      volume: 2400
    });
  });

  it("uses the DB value without hitting the API when the document is fresh", async () => {
    const now = new Date("2026-03-11T12:00:00.000Z");
    const repository = new FakeStocksRepository([
      toStockDocument(
        makeProfile({ price: 330, changePct: 2.1, volume: 3100 }),
        new Date("2026-03-11T11:57:00.000Z")
      )
    ]);
    const refreshStock = vi.fn(async () => null);

    const [stock] = await loadHomeStocksFromDb({
      catalog: [makeProfile()],
      now,
      repository,
      refreshStock
    });

    expect(stock.price).toBe(330);
    expect(refreshStock).not.toHaveBeenCalled();
  });

  it("refreshes stale DB data and returns the updated DB value", async () => {
    const now = new Date("2026-03-11T12:00:00.000Z");
    const repository = new FakeStocksRepository([
      toStockDocument(
        makeProfile({ price: 300, changePct: 1.1, volume: 2800 }),
        new Date("2026-03-11T11:40:00.000Z")
      )
    ]);
    const refreshStock = vi.fn(async (profile: SymbolProfile) => ({
      ...profile,
      price: 410,
      changePct: 5.5,
      volume: 9200
    }));

    const [stock] = await loadHomeStocksFromDb({
      catalog: [makeProfile()],
      now,
      repository,
      refreshStock
    });

    expect(stock.price).toBe(410);
    expect(await repository.findStock("NVDA", "US")).toMatchObject({
      price: 410,
      fluctuation_rate: 5.5,
      volume: 9200,
      create_at: now
    });
  });

  it("reuses stale DB data when the API refresh fails", async () => {
    const repository = new FakeStocksRepository([
      toStockDocument(
        makeProfile({ price: 305, changePct: -2.2, volume: 5100 }),
        new Date("2026-03-11T11:40:00.000Z")
      )
    ]);
    const refreshStock = vi.fn(async () => null);

    const [stock] = await loadHomeStocksFromDb({
      catalog: [makeProfile()],
      now: new Date("2026-03-11T12:00:00.000Z"),
      repository,
      refreshStock
    });

    expect(stock.price).toBe(305);
    expect(stock.changePct).toBe(-2.2);
    expect(refreshStock).toHaveBeenCalledTimes(1);
  });

  it("seeds the DB from the catalog when both DB and API are unavailable", async () => {
    const repository = new FakeStocksRepository();
    const refreshStock = vi.fn(async () => null);

    const [stock] = await loadHomeStocksFromDb({
      catalog: [makeProfile({ market: "KR", symbol: "005930", name: "삼성전자", price: 74800 })],
      now: new Date("2026-03-11T12:00:00.000Z"),
      repository,
      refreshStock
    });

    expect(stock.price).toBe(74800);
    expect(await repository.findStock("005930", "KR")).toMatchObject({
      _id: "KR:005930",
      object_id: "KR:005930",
      name: "삼성전자",
      ticker: "005930",
      price: 74800
    });
  });

  it("uses the same DB-first policy for single stock loads", async () => {
    const now = new Date("2026-03-11T12:00:00.000Z");
    const repository = new FakeStocksRepository([
      toStockDocument(
        makeProfile({ price: 330, changePct: 2.1, volume: 3100 }),
        new Date("2026-03-11T11:57:00.000Z")
      )
    ]);
    const refreshStock = vi.fn(async () => null);

    const stock = await loadTrackedStock("US", "nvda", {
      catalog: [makeProfile()],
      now,
      repository,
      refreshStock
    });

    expect(stock?.price).toBe(330);
    expect(stock?.changePct).toBe(2.1);
    expect(refreshStock).not.toHaveBeenCalled();
  });

  it("refreshes stale DB data for single stock loads and stores the updated snapshot", async () => {
    const now = new Date("2026-03-11T12:00:00.000Z");
    const repository = new FakeStocksRepository([
      toStockDocument(
        makeProfile({ price: 300, changePct: 1.1, volume: 2800 }),
        new Date("2026-03-11T11:40:00.000Z")
      )
    ]);
    const refreshStock = vi.fn(async (profile: SymbolProfile) => ({
      ...profile,
      price: 410,
      changePct: 5.5,
      volume: 9200
    }));

    const stock = await loadTrackedStock("US", "NVDA", {
      catalog: [makeProfile()],
      now,
      repository,
      refreshStock
    });

    expect(stock?.price).toBe(410);
    expect(refreshStock).toHaveBeenCalledTimes(1);
    expect(await repository.findStock("NVDA", "US")).toMatchObject({
      price: 410,
      fluctuation_rate: 5.5,
      volume: 9200,
      create_at: now
    });
  });
});
