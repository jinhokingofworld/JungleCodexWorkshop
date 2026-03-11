import { canUseMongo, getStocksCollection, type StockDocument } from "@/lib/server/db";
import type { Market, SymbolProfile } from "@/lib/types";

export const STOCK_REFRESH_INTERVAL_MS = 5 * 60_000;

export interface StocksRepository {
  findStock(ticker: string, nation: Market): Promise<StockDocument | null>;
  upsertStock(stockDoc: StockDocument): Promise<StockDocument>;
}

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase();
}

export function buildStockObjectId(nation: Market, ticker: string) {
  return `${nation}:${normalizeTicker(ticker)}`;
}

export function isStockFresh(
  createAt: Date | string,
  now: Date = new Date(),
  maxAgeMs: number = STOCK_REFRESH_INTERVAL_MS
) {
  return now.getTime() - new Date(createAt).getTime() < maxAgeMs;
}

export function toStockDocument(
  profile: SymbolProfile,
  createAt: Date = new Date()
): StockDocument {
  const ticker = normalizeTicker(profile.symbol);
  const objectId = buildStockObjectId(profile.market, ticker);

  return {
    _id: objectId,
    object_id: objectId,
    name: profile.name,
    ticker,
    price: profile.price,
    nation: profile.market,
    fluctuation_rate: profile.changePct,
    volume: profile.volume,
    create_at: createAt
  };
}

export function fromStockDocument(
  profile: SymbolProfile,
  document: StockDocument
): SymbolProfile {
  return {
    ...profile,
    market: document.nation,
    symbol: document.ticker,
    name: document.name,
    price: document.price,
    changePct: document.fluctuation_rate,
    volume: document.volume
  };
}

class MongoStocksRepository implements StocksRepository {
  async findStock(ticker: string, nation: Market) {
    const stocks = await getStocksCollection();
    return stocks.findOne({ _id: buildStockObjectId(nation, ticker) });
  }

  async upsertStock(stockDoc: StockDocument) {
    const stocks = await getStocksCollection();
    const document = {
      ...stockDoc,
      _id: buildStockObjectId(stockDoc.nation, stockDoc.ticker),
      object_id: buildStockObjectId(stockDoc.nation, stockDoc.ticker),
      ticker: normalizeTicker(stockDoc.ticker)
    };

    await stocks.updateOne(
      { _id: document._id },
      {
        $set: document
      },
      { upsert: true }
    );

    return (await stocks.findOne({ _id: document._id })) ?? document;
  }
}

const mongoStocksRepository = new MongoStocksRepository();

export function getStocksRepository(): StocksRepository | null {
  return canUseMongo() ? mongoStocksRepository : null;
}
