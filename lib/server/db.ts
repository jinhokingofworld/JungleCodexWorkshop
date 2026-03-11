import { MongoClient, ServerApiVersion, type Collection, type Db } from "mongodb";
import type { AnalysisSession, Market } from "@/lib/types";

const globalMongo = globalThis as typeof globalThis & {
  __mongoClientPromise?: Promise<MongoClient>;
};

export interface StockDocument {
  _id: string;
  object_id: string;
  name: string;
  ticker: string;
  price: number;
  nation: Market;
  fluctuation_rate: number;
  volume: number;
  create_at: Date;
}

export interface DebateDocument {
  _id: string;
  object_id: string;
  stock_name: string;
  stock_code: string;
  contents: string;
  keyword: string;
  create_at: Date;
  likes: number;
  replay_count: number;
  board_score: number;
  session: AnalysisSession;
}

export interface PersonaDocument {
  _id: string;
  object_id: string;
  name: string;
  count: number;
}

export function canUseMongo() {
  return Boolean(process.env.MONGODB_URI) && process.env.NODE_ENV !== "test";
}

async function getMongoClient() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing");
  }

  if (!globalMongo.__mongoClientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI, {
      serverApi: ServerApiVersion.v1
    });
    globalMongo.__mongoClientPromise = client.connect().catch((error) => {
      delete globalMongo.__mongoClientPromise;
      throw error;
    });
  }

  return globalMongo.__mongoClientPromise;
}

export async function closeMongoClient() {
  const clientPromise = globalMongo.__mongoClientPromise;
  if (!clientPromise) {
    return;
  }

  try {
    const client = await clientPromise;
    await client.close();
  } finally {
    delete globalMongo.__mongoClientPromise;
  }
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB_NAME ?? "week2");
}

export async function getStocksCollection(): Promise<Collection<StockDocument>> {
  return (await getMongoDb()).collection<StockDocument>("stocks");
}

export async function getDebatesCollection(): Promise<Collection<DebateDocument>> {
  return (await getMongoDb()).collection<DebateDocument>("debates");
}

export async function getPersonasCollection(): Promise<Collection<PersonaDocument>> {
  return (await getMongoDb()).collection<PersonaDocument>("personas");
}
