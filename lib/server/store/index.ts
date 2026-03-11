import type {
  AnalysisSession,
  CreateAnalysisInput,
  SessionPreview
} from "@/lib/types";
import { buildEvidenceBundle } from "@/lib/server/providers";
import { generateStructuredAnalysis } from "@/lib/server/llm/provider";
import { findSymbol, symbolCatalog } from "@/lib/mock-data";
import { pickWatchwords, sentimentFromChange } from "@/lib/server/utils";

interface AnalysisStore {
  createSession(input: CreateAnalysisInput): Promise<AnalysisSession>;
  getSession(id: string): AnalysisSession | null;
  getRecent(limit?: number): SessionPreview[];
  getPopular(limit?: number): SessionPreview[];
  incrementReplayCount(id: string): AnalysisSession | null;
  seedIfNeeded(): Promise<void>;
}

const globalStore = globalThis as typeof globalThis & {
  __analysisStore?: MemoryAnalysisStore;
};

function createPreview(session: AnalysisSession): SessionPreview {
  return {
    id: session.id,
    market: session.market,
    symbol: session.symbol,
    symbolName: session.symbolName,
    createdAt: session.createdAt,
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

class MemoryAnalysisStore implements AnalysisStore {
  private sessions = new Map<string, AnalysisSession>();

  async createSession(input: CreateAnalysisInput) {
    const bundle = await buildEvidenceBundle(input.market, input.symbol);
    const generated = await generateStructuredAnalysis(bundle, input.userQuestion);
    const id = `${input.market.toLowerCase()}-${input.symbol.toLowerCase()}-${Date.now()}`;

    const boardScore =
      50 +
      Math.round(Math.abs(bundle.symbol.changePct) * 12) +
      (sentimentFromChange(bundle.symbol.changePct) === "bullish" ? 8 : 4);

    const session: AnalysisSession = {
      id,
      market: input.market,
      symbol: bundle.symbol.symbol,
      symbolName: bundle.symbol.name,
      createdAt: new Date().toISOString(),
      replayCount: 0,
      boardScore,
      optionalQuestion: input.userQuestion,
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
    };

    this.sessions.set(id, session);
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

  incrementReplayCount(id: string) {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    session.replayCount += 1;
    this.sessions.set(id, session);
    return session;
  }

  async seedIfNeeded() {
    if (this.sessions.size > 0) {
      return;
    }

    const defaults = symbolCatalog.filter((symbol) =>
      ["005930", "000660", "NVDA", "TSLA"].includes(symbol.symbol)
    );

    for (const profile of defaults) {
      const session = await this.createSession({
        market: profile.market,
        symbol: profile.symbol,
        forceFresh: true
      });

      session.replayCount = Math.round(profile.volume / 1_000_000);
      this.sessions.set(session.id, session);
    }
  }
}

function getStoreInstance() {
  if (!globalStore.__analysisStore) {
    globalStore.__analysisStore = new MemoryAnalysisStore();
  }

  return globalStore.__analysisStore;
}

export const analysisStore = getStoreInstance();

export async function ensureSeedData() {
  await analysisStore.seedIfNeeded();
}

export async function getSessionOrThrow(id: string) {
  await ensureSeedData();
  const session = analysisStore.getSession(id);
  if (!session) {
    throw new Error(`Unknown session: ${id}`);
  }

  return session;
}

export async function createAnalysisSession(input: CreateAnalysisInput) {
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

export async function incrementSessionReplay(id: string) {
  await ensureSeedData();
  return analysisStore.incrementReplayCount(id);
}
