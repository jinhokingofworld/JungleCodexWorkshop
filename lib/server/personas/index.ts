import {
  getDefaultPersonaIdsFromRecords,
  personaOptionFromRecord
} from "@/lib/personas";
import { personaRepository } from "@/lib/server/personas/repository";
import type { PersonaOption, SelectedPersona } from "@/lib/types";

const MIN_SELECTED_PERSONAS = 2;
const MAX_SELECTED_PERSONAS = 4;

export async function listAvailablePersonas() {
  const records = await personaRepository.list();
  return records.map(personaOptionFromRecord);
}

export async function getDefaultPersonaIds() {
  const records = await personaRepository.list();
  return getDefaultPersonaIdsFromRecords(records);
}

export async function resolveSelectedPersonas(personaIds: string[]) {
  if (!Array.isArray(personaIds) || !personaIds.every((id) => typeof id === "string")) {
    throw new Error("personaIds must be a string array.");
  }

  if (personaIds.length < MIN_SELECTED_PERSONAS || personaIds.length > MAX_SELECTED_PERSONAS) {
    throw new Error("Select between 2 and 4 personas to start a debate.");
  }

  if (new Set(personaIds).size !== personaIds.length) {
    throw new Error("Duplicate personas are not allowed.");
  }

  const records = await personaRepository.findByIds(personaIds);
  if (records.length !== personaIds.length) {
    throw new Error("One or more selected personas are invalid.");
  }

  return records.map(personaOptionFromRecord);
}

export function toSelectedPersonaSummaries(personas: PersonaOption[]): SelectedPersona[] {
  return personas.map(({ id, name, label }) => ({
    id,
    name,
    label
  }));
}

export { MIN_SELECTED_PERSONAS, MAX_SELECTED_PERSONAS };
