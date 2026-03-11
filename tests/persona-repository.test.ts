import { describe, expect, it } from "vitest";
import { listAvailablePersonas } from "@/lib/server/personas";
import { personaRepository } from "@/lib/server/personas/repository";

describe("persona repository", () => {
  it("returns 8 seeded personas with stable pseudo object ids", async () => {
    const personas = await personaRepository.list();

    expect(personas).toHaveLength(8);
    expect(new Set(personas.map((persona) => persona.id)).size).toBe(8);
    expect(personas.every((persona) => /^[a-f0-9]{24}$/i.test(persona.id))).toBe(true);
  });

  it("finds personas in requested order and preserves duplicate lookups", async () => {
    const personas = await personaRepository.list();
    const requestedIds = [personas[2].id, "missing", personas[0].id, personas[2].id];

    const resolved = await personaRepository.findByIds(requestedIds);

    expect(resolved.map((persona) => persona.id)).toEqual([
      personas[2].id,
      personas[0].id,
      personas[2].id
    ]);
  });

  it("enriches repository records into API-ready persona options", async () => {
    const personas = await listAvailablePersonas();

    expect(personas).toHaveLength(8);
    expect(personas.every((persona) => persona.label.length > 0)).toBe(true);
    expect(personas.every((persona) => persona.description.length > 0)).toBe(true);
  });
});
