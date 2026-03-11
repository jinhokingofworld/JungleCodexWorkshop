import { PERSONA_PRESET_SEED } from "@/lib/personas";
import type { PersonaRecord } from "@/lib/types";

export interface PersonaRepository {
  list(): Promise<PersonaRecord[]>;
  findByIds(ids: string[]): Promise<PersonaRecord[]>;
}

class InMemoryPersonaRepository implements PersonaRepository {
  private readonly personas: PersonaRecord[];

  constructor(seed: PersonaRecord[]) {
    this.personas = seed.map((persona) => ({ ...persona }));
  }

  async list() {
    return this.personas.map((persona) => ({ ...persona }));
  }

  async findByIds(ids: string[]) {
    const byId = new Map(this.personas.map((persona) => [persona.id, persona]));

    return ids.flatMap((id) => {
      const persona = byId.get(id);
      return persona ? [{ ...persona }] : [];
    });
  }
}

export const personaRepository: PersonaRepository = new InMemoryPersonaRepository(
  PERSONA_PRESET_SEED
);
