import type {
  AnalysisSession,
  CreateAnalysisInput,
  PersonaOption,
  SelectedPersona,
  SessionPreview
} from "@/lib/types";
import {
  canUseMongo,
  getDebatesCollection,
  type DebateDocument
} from "@/lib/server/db";
import { findSymbol, symbolCatalog } from "@/lib/mock-data";
import {
  getDefaultPersonaIds,
  resolveSelectedPersonas,
  toSelectedPersonaSummaries
} from "@/lib/server/personas";
import { buildEvidenceBundle } from "@/lib/server/providers";
import { generateStructuredAnalysis } from "@/lib/server/llm/provider";
import { pickWatchwords, sentimentFromChange } from "@/lib/server/utils";

interface CreateAnalysisSessionInput extends CreateAnalysisInput {
  personas: PersonaOption[];
  selectedPersonas: SelectedPersona[];
}

interface AnalysisStore {
  createSession(input: CreateAnalysisSessionInput): Promise<AnalysisSession>;
  getSession(id: string): Promise<AnalysisSession | null> | AnalysisSession | null;
  getRecent(limit?: number): Promise<SessionPreview[]> | SessionPreview[];
  getPopular(limit?: number): Promise<SessionPreview[]> | SessionPreview[];
  getTopLiked(limit?: number): Promise<SessionPreview[]> | SessionPreview[];
  incrementReplayCount(id: string): Promise<AnalysisSession | null> | AnalysisSession | null;
  incrementLike(id: string): Promise<AnalysisSession | null> | AnalysisSession | null;
  decrementLike(id: string): Promise<AnalysisSession | null> | AnalysisSession | null;
  seedIfNeeded(): Promise<void>;
}

const globalStore = globalThis as typeof globalThis & {
  __analysisStore?: AnalysisStore;
};

function createPreview(session: AnalysisSession): SessionPreview {
  return {
    id: session.id,
    market: session.market,
    symbol: session.symbol,
    symbolName: session.symbolName,
    createdAt: session.createdAt,
    likes: session.likes,
    replayCount: session.replayCount,
    boardScore: session.boardScore,
    overallView: session.finalReport.overallView,
    summary: session.timingCard.summary,
    watchword: pickWatchwords({
      market: session.market,
      symbol: session.symbol,
      name: session.symbolName,
      exchange: session.overview.exchange,
      sector: session.overview.sector,
      currency: session.market === "KR" ? "KRW" : "USD",
      price: session.overview.price,
      changePct: session.overview.changePct,
      volume: 0
    })
  };
}

function toDebateDocument(session: AnalysisSession): DebateDocument {
  const keywords = pickWatchwords({
    market: session.market,
    symbol: session.symbol,
    name: session.symbolName,
    exchange: session.overview.exchange,
    sector: session.overview.sector,
    currency: session.market === "KR" ? "KRW" : "USD",
    price: session.overview.price,
    changePct: session.overview.changePct,
    volume: 0
  });

  return {
    _id: session.id,
    object_id: session.id,
    stock_name: session.symbolName,
    stock_code: session.symbol,
    contents: session.finalReport.overallView,
    keyword: keywords.join(", "),
    create_at: new Date(session.createdAt),
    likes: session.likes,
    replay_count: session.replayCount,
    board_score: session.boardScore,
    session
  };
}

async function buildSession(input: CreateAnalysisSessionInput) {
  const bundle = await buildEvidenceBundle(input.market, input.symbol);
  const generated = await generateStructuredAnalysis(
    bundle,
    input.personas,
    input.userQuestion
  );
  const id = `${input.market.toLowerCase()}-${input.symbol.toLowerCase()}-${Date.now()}`;

  const boardScore =
    50 +
    Math.round(Math.abs(bundle.symbol.changePct) * 12) +
    (sentimentFromChange(bundle.symbol.changePct) === "bullish" ? 8 : 4);

  return {
    id,
    market: input.market,
    symbol: bundle.symbol.symbol,
    symbolName: bundle.symbol.name,
    createdAt: new Date().toISOString(),
    likes: 0,
    replayCount: 0,
    boardScore,
    optionalQuestion: input.userQuestion,
    selectedPersonas: input.selectedPersonas,
    evidence: bundle.items,
    messages: generated.messages,
    timingCard: generated.timingCard,
    finalReport: generated.finalReport,
    overview: {
      price: bundle.symbol.price,
      changePct: bundle.symbol.changePct,
      exchange: bundle.symbol.exchange,
      sector: bundle.symbol.sector
    }
  } satisfies AnalysisSession;
}

class MemoryAnalysisStore implements AnalysisStore {
  private sessions = new Map<string, AnalysisSession>();

  async createSession(input: CreateAnalysisSessionInput) {
    const session = await buildSession(input);

    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string) {
    return this.sessions.get(id) ?? null;
  }

  getRecent(limit = 8) {
    return [...this.sessions.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(createPreview);
  }

  getPopular(limit = 8) {
    return [...this.sessions.values()]
      .sort((a, b) => {
        const scoreDelta = b.boardScore + b.replayCount * 3 - (a.boardScore + a.replayCount * 3);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        return b.createdAt.localeCompare(a.createdAt);
      })
      .slice(0, limit)
      .map(createPreview);
  }

  getTopLiked(limit = 8) {
    return [...this.sessions.values()]
      .sort((a, b) => b.likes - a.likes || b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(createPreview);
  }

  incrementReplayCount(id: string) {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    session.replayCount += 1;
    this.sessions.set(id, session);
    return session;
  }

  incrementLike(id: string) {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    session.likes += 1;
    this.sessions.set(id, session);
    return session;
  }

  decrementLike(id: string) {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    session.likes = Math.max(0, session.likes - 1);
    this.sessions.set(id, session);
    return session;
  }

  async seedIfNeeded() {
    if (this.sessions.size > 0) {
      return;
    }

    const defaultPersonaIds = await getDefaultPersonaIds();
    const personas = await resolveSelectedPersonas(defaultPersonaIds);
    const selectedPersonas = toSelectedPersonaSummaries(personas);
    const defaults = symbolCatalog.filter((symbol) =>
      ["005930", "000660", "NVDA", "TSLA"].includes(symbol.symbol)
    );

    for (const profile of defaults) {
      const session = await this.createSession({
        market: profile.market,
        symbol: profile.symbol,
        personaIds: defaultPersonaIds,
        personas,
        selectedPersonas,
        forceFresh: true
      });

      session.replayCount = Math.round(profile.volume / 1_000_000);
      this.sessions.set(session.id, session);
    }
  }
}

class MongoAnalysisStore implements AnalysisStore {
  async createSession(input: CreateAnalysisSessionInput) {
    const session = await buildSession(input);
    const debates = await getDebatesCollection();
    await debates.updateOne(
      { _id: session.id },
      { $set: toDebateDocument(session) },
      { upsert: true }
    );
    return session;
  }

  async getSession(id: string) {
    const debates = await getDebatesCollection();
    const document = await debates.findOne({ _id: id });
    return document
      ? {
          ...document.session,
          likes: document.session.likes ?? document.likes
        }
      : null;
  }

  async getRecent(limit = 8) {
    const debates = await getDebatesCollection();
    return debates
      .find({})
      .sort({ create_at: -1 })
      .limit(limit)
      .toArray()
      .then((documents) =>
        documents.map((document) =>
          createPreview({
            ...document.session,
            likes: document.session.likes ?? document.likes
          })
        )
      );
  }

  async getPopular(limit = 8) {
    const debates = await getDebatesCollection();
    const documents = await debates
      .aggregate<DebateDocument & { popularity: number }>([
        {
          $addFields: {
            popularity: {
              $add: ["$board_score", { $multiply: ["$replay_count", 3] }]
            }
          }
        },
        {
          $sort: {
            popularity: -1,
            create_at: -1
          }
        },
        { $limit: limit }
      ])
      .toArray();

    return documents.map((document) =>
      createPreview({
        ...document.session,
        likes: document.session.likes ?? document.likes
      })
    );
  }

  async getTopLiked(limit = 8) {
    const debates = await getDebatesCollection();
    const documents = await debates.find({}).sort({ likes: -1, create_at: -1 }).limit(limit).toArray();

    return documents.map((document) =>
      createPreview({
        ...document.session,
        likes: document.session.likes ?? document.likes
      })
    );
  }

  async incrementReplayCount(id: string) {
    const debates = await getDebatesCollection();
    await debates.updateOne(
      { _id: id },
      {
        $inc: {
          replay_count: 1,
          "session.replayCount": 1
        }
      }
    );

    const document = await debates.findOne({ _id: id });
    return document
      ? {
          ...document.session,
          likes: document.session.likes ?? document.likes
        }
      : null;
  }

  async incrementLike(id: string) {
    const debates = await getDebatesCollection();
    await debates.updateOne(
      { _id: id },
      {
        $inc: {
          likes: 1,
          "session.likes": 1
        }
      }
    );

    const document = await debates.findOne({ _id: id });
    return document
      ? {
          ...document.session,
          likes: document.session.likes ?? document.likes
        }
      : null;
  }

  async decrementLike(id: string) {
    const debates = await getDebatesCollection();
    await debates.updateOne(
      { _id: id },
      [
        {
          $set: {
            likes: { $max: [0, { $subtract: ["$likes", 1] }] },
            "session.likes": { $max: [0, { $subtract: ["$session.likes", 1] }] }
          }
        }
      ]
    );

    const document = await debates.findOne({ _id: id });
    return document
      ? {
          ...document.session,
          likes: document.session.likes ?? document.likes
        }
      : null;
  }

  async seedIfNeeded() {
    const debates = await getDebatesCollection();
    const existingCount = await debates.countDocuments();
    if (existingCount > 0) {
      return;
    }

    const defaultPersonaIds = await getDefaultPersonaIds();
    const personas = await resolveSelectedPersonas(defaultPersonaIds);
    const selectedPersonas = toSelectedPersonaSummaries(personas);
    const defaults = symbolCatalog.filter((symbol) =>
      ["005930", "000660", "NVDA", "TSLA"].includes(symbol.symbol)
    );

    for (const profile of defaults) {
      const session = await this.createSession({
        market: profile.market,
        symbol: profile.symbol,
        personaIds: defaultPersonaIds,
        personas,
        selectedPersonas,
        forceFresh: true
      });

      await debates.updateOne(
        { _id: session.id },
        {
          $set: {
            replay_count: Math.round(profile.volume / 1_000_000),
            "session.replayCount": Math.round(profile.volume / 1_000_000)
          }
        }
      );
    }
  }
}

function getStoreInstance() {
  if (!globalStore.__analysisStore) {
    globalStore.__analysisStore = canUseMongo()
      ? new MongoAnalysisStore()
      : new MemoryAnalysisStore();
  }

  return globalStore.__analysisStore;
}

export const analysisStore = getStoreInstance();

export async function ensureSeedData() {
  await analysisStore.seedIfNeeded();
}

export async function getSessionOrThrow(id: string) {
  await ensureSeedData();
  const session = await analysisStore.getSession(id);
  if (!session) {
    throw new Error(`Unknown session: ${id}`);
  }

  return session;
}

export async function createAnalysisSession(input: CreateAnalysisSessionInput) {
  const profile = findSymbol(input.market, input.symbol);
  if (!profile) {
    throw new Error(`Unsupported symbol: ${input.market}/${input.symbol}`);
  }

  return analysisStore.createSession(input);
}

export async function listRecentSessions(limit?: number) {
  await ensureSeedData();
  return analysisStore.getRecent(limit);
}

export async function listPopularSessions(limit?: number) {
  await ensureSeedData();
  return analysisStore.getPopular(limit);
}

export async function listTopLikedSessions(limit?: number) {
  await ensureSeedData();
  return analysisStore.getTopLiked(limit);
}

export async function incrementSessionReplay(id: string) {
  await ensureSeedData();
  return analysisStore.incrementReplayCount(id);
}

export async function incrementSessionLike(id: string) {
  await ensureSeedData();
  return analysisStore.incrementLike(id);
}

export async function decrementSessionLike(id: string) {
  await ensureSeedData();
  return analysisStore.decrementLike(id);
}
