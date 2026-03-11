import type { CreateAnalysisInput } from "@/lib/types";
import {
  createAnalysisSession,
  ensureSeedData,
  getSessionOrThrow,
  incrementSessionReplay,
  listPopularSessions,
  listRecentSessions
} from "@/lib/server/store";

export async function prepareHomeData() {
  await ensureSeedData();

  return {
    popular: await listPopularSessions(4),
    recent: await listRecentSessions(6)
  };
}

export async function createNewAnalysis(input: CreateAnalysisInput) {
  return createAnalysisSession({
    ...input,
    forceFresh: input.forceFresh ?? true
  });
}

export async function getAnalysisSession(id: string) {
  return getSessionOrThrow(id);
}

export async function registerReplay(id: string) {
  return incrementSessionReplay(id);
}
