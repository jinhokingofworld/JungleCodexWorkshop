import { beforeEach, describe, expect, it } from "vitest";
import {
  createNewAnalysis,
  listPersonas,
  prepareHomeData,
  registerPersonaLike,
  registerSessionLike
} from "@/lib/server/analysis-service";
import { listTopPersonasByLikes } from "@/lib/server/personas";

describe("likes flow", () => {
  beforeEach(() => {
    delete (
      globalThis as typeof globalThis & {
        __analysisStore?: unknown;
      }
    ).__analysisStore;
  });

  it("increments persona likes and returns the leaderboard sorted by count", async () => {
    const personas = await listPersonas();

    await registerPersonaLike(personas[2].id);
    await registerPersonaLike(personas[2].id);
    await registerPersonaLike(personas[0].id);

    const leaderboard = await listTopPersonasByLikes(8);

    expect(leaderboard[0]?.id).toBe(personas[2].id);
    expect(leaderboard[0]?.count).toBe(2);
    expect(leaderboard[1]?.id).toBe(personas[0].id);
    expect(leaderboard[1]?.count).toBe(1);
  });

  it("increments debate likes and exposes like-ranked sessions in home data", async () => {
    const personas = await listPersonas();
    const selectedIds = personas.slice(0, 2).map((persona) => persona.id);

    const first = await createNewAnalysis({
      market: "KR",
      symbol: "005930",
      personaIds: selectedIds,
      forceFresh: true
    });
    const second = await createNewAnalysis({
      market: "US",
      symbol: "NVDA",
      personaIds: selectedIds,
      forceFresh: true
    });

    await registerSessionLike(second.id);
    await registerSessionLike(second.id);
    await registerSessionLike(first.id);

    const home = await prepareHomeData();

    expect(home.personaLeaderboard).toHaveLength(8);
    expect(home.debateLikeLeaderboard[0]?.id).toBe(second.id);
    expect(home.debateLikeLeaderboard[0]?.likes).toBe(2);
    expect(home.debateLikeLeaderboard[1]?.id).toBe(first.id);
    expect(home.debateLikeLeaderboard[1]?.likes).toBe(1);
  });

  it("does not change persona likes when creating a debate", async () => {
    const before = await listTopPersonasByLikes(8);
    const personas = await listPersonas();

    await createNewAnalysis({
      market: "KR",
      symbol: "005930",
      personaIds: personas.slice(0, 3).map((persona) => persona.id),
      forceFresh: true
    });

    const after = await listTopPersonasByLikes(8);

    expect(after.map((persona) => persona.count)).toEqual(before.map((persona) => persona.count));
  });
});
