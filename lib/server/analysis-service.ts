import type { CreateAnalysisInput } from "@/lib/types";
import {
  listAvailablePersonas,
  resolveSelectedPersonas,
  toSelectedPersonaSummaries
} from "@/lib/server/personas";
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
  const personas = await resolveSelectedPersonas(input.personaIds);

  return createAnalysisSession({
    ...input,
    forceFresh: input.forceFresh ?? true,
    personas,
    selectedPersonas: toSelectedPersonaSummaries(personas)
  });
}

export async function listPersonas() {
  return listAvailablePersonas();
}

export async function getAnalysisSession(id: string) {
  return getSessionOrThrow(id);
}

export async function registerReplay(id: string) {
  return incrementSessionReplay(id);
}
