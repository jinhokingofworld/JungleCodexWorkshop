import type { CreateAnalysisInput } from "@/lib/types";
import {
  likePersona,
  listAvailablePersonas,
  listTopPersonasByLikes,
  resolveSelectedPersonas,
  toSelectedPersonaSummaries,
  unlikePersona
} from "@/lib/server/personas";
import {
  createAnalysisSession,
  decrementSessionLike,
  ensureSeedData,
  getSessionOrThrow,
  incrementSessionLike,
  incrementSessionReplay,
  listTopLikedSessions,
  listPopularSessions,
  listRecentSessions
} from "@/lib/server/store";

export async function prepareHomeData() {
  await ensureSeedData();

  return {
    debateLikeLeaderboard: await listTopLikedSessions(3),
    personaLeaderboard: await listTopPersonasByLikes(8),
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

export async function registerPersonaLike(id: string) {
  return likePersona(id);
}

export async function unregisterPersonaLike(id: string) {
  return unlikePersona(id);
}

export async function getAnalysisSession(id: string) {
  return getSessionOrThrow(id);
}

export async function registerReplay(id: string) {
  return incrementSessionReplay(id);
}

export async function registerSessionLike(id: string) {
  return incrementSessionLike(id);
}

export async function unregisterSessionLike(id: string) {
  return decrementSessionLike(id);
}
