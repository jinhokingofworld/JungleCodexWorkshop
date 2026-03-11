import { PERSONA_PRESET_SEED } from "@/lib/personas";
import { canUseMongo, getPersonasCollection } from "@/lib/server/db";
import type { PersonaName, PersonaRecord } from "@/lib/types";

export interface PersonaRepository {
  list(): Promise<PersonaRecord[]>;
  findByIds(ids: string[]): Promise<PersonaRecord[]>;
  listTopByLikes(limit?: number): Promise<PersonaRecord[]>;
  incrementLike(id: string): Promise<PersonaRecord | null>;
  decrementLike(id: string): Promise<PersonaRecord | null>;
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

  async listTopByLikes(limit = this.personas.length) {
    return this.personas
      .map((persona) => ({ ...persona }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  async incrementLike(id: string) {
    const persona = this.personas.find((item) => item.id === id);
    if (!persona) {
      return null;
    }

    persona.count += 1;
    return { ...persona };
  }

  async decrementLike(id: string) {
    const persona = this.personas.find((item) => item.id === id);
    if (!persona) {
      return null;
    }

    persona.count = Math.max(0, persona.count - 1);
    return { ...persona };
  }
}

class MongoPersonaRepository implements PersonaRepository {
  private async ensureSeed() {
    const collection = await getPersonasCollection();

    await Promise.all(
      PERSONA_PRESET_SEED.map((persona) =>
        collection.updateOne(
          { _id: persona.id },
          {
            $setOnInsert: {
              _id: persona.id,
              object_id: persona.id,
              name: persona.name,
              count: persona.count
            }
          },
          { upsert: true }
        )
      )
    );
  }

  async list() {
    await this.ensureSeed();
    const collection = await getPersonasCollection();
    const documents = await collection
      .find({ _id: { $in: PERSONA_PRESET_SEED.map((persona) => persona.id) } })
      .toArray();
    const byId = new Map(documents.map((document) => [document._id, document]));

    return PERSONA_PRESET_SEED.map((persona) => {
      const current = byId.get(persona.id);
      return {
        id: persona.id,
        name: persona.name,
        count: current?.count ?? persona.count
      };
    });
  }

  async findByIds(ids: string[]) {
    const personas = await this.list();
    const byId = new Map(personas.map((persona) => [persona.id, persona]));

    return ids.flatMap((id) => {
      const persona = byId.get(id);
      return persona ? [{ ...persona }] : [];
    });
  }

  async listTopByLikes(limit = PERSONA_PRESET_SEED.length) {
    const personas = await this.list();
    return personas
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  async incrementLike(id: string) {
    await this.ensureSeed();
    const collection = await getPersonasCollection();
    await collection.updateOne({ _id: id }, { $inc: { count: 1 } });
    const updated = await collection.findOne({ _id: id });

    if (!updated) {
      return null;
    }

    return {
      id: updated._id,
      name: updated.name as PersonaName,
      count: updated.count
    };
  }

  async decrementLike(id: string) {
    await this.ensureSeed();
    const collection = await getPersonasCollection();
    await collection.updateOne({ _id: id }, [{ $set: { count: { $max: [0, { $subtract: ["$count", 1] }] } } }]);
    const updated = await collection.findOne({ _id: id });

    if (!updated) {
      return null;
    }

    return {
      id: updated._id,
      name: updated.name as PersonaName,
      count: updated.count
    };
  }
}

export const personaRepository: PersonaRepository = canUseMongo()
  ? new MongoPersonaRepository()
  : new InMemoryPersonaRepository(PERSONA_PRESET_SEED);
