# Persona Mongo Handoff

- Target collection: `persona`
- Target document shape: `ObjectId _id`, `string name`, `number count`
- Current swap point: replace `InMemoryPersonaRepository` in `lib/server/personas/repository.ts` with a Mongo-backed implementation that preserves the existing `PersonaRepository` interface.
- Keep the API response shape stable: `GET /api/personas` should continue returning `{ personas: Array<{ id, name, count, label, description }> }`.
- Keep analysis input stable: `POST /api/analysis` should continue accepting `personaIds: string[]`, where each value is the string form of Mongo `_id`.
