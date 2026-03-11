"use client";

import { useEffect, useState } from "react";
import {
  hasLikedPersona,
  markPersonaLiked,
  unmarkPersonaLiked
} from "@/lib/likes";
import type { PersonaOption } from "@/lib/types";

interface PersonaLikeLeaderboardProps {
  initialPersonas: PersonaOption[];
}

function sortPersonas(personas: PersonaOption[]) {
  return [...personas].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function PersonaLikeLeaderboard({
  initialPersonas
}: PersonaLikeLeaderboardProps) {
  const [personas, setPersonas] = useState(() => sortPersonas(initialPersonas));
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    setPersonas(sortPersonas(initialPersonas));
    setLikedIds(
      new Set(
        initialPersonas
          .filter((persona) => hasLikedPersona(persona.id))
          .map((persona) => persona.id)
      )
    );
  }, [initialPersonas]);

  async function handleLike(id: string) {
    if (pendingId) {
      return;
    }

    const shouldUnlike = likedIds.has(id);
    setPendingId(id);
    setPersonas((current) =>
      sortPersonas(
        current.map((persona) =>
          persona.id === id
            ? {
                ...persona,
                count: Math.max(0, persona.count + (shouldUnlike ? -1 : 1))
              }
            : persona
        )
      )
    );

    try {
      const response = await fetch(`/api/personas/${id}/like`, {
        method: shouldUnlike ? "DELETE" : "POST"
      });
      const payload = (await response.json()) as { persona?: PersonaOption; error?: string };
      if (!response.ok || !payload.persona) {
        throw new Error(payload.error ?? "Failed to toggle persona like.");
      }

      setPersonas((current) =>
        sortPersonas(current.map((persona) => (persona.id === id ? payload.persona! : persona)))
      );
      setLikedIds((current) => {
        const next = new Set(current);
        if (shouldUnlike) {
          next.delete(id);
          unmarkPersonaLiked(id);
        } else {
          next.add(id);
          markPersonaLiked(id);
        }
        return next;
      });
    } catch {
      setPersonas(sortPersonas(initialPersonas));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="persona-leaderboard">
      <div className="leaderboard-header">
        <p className="eyebrow">persona likes</p>
      </div>
      <div className="leaderboard-list compact">
        {personas.map((persona, index) => {
          const liked = likedIds.has(persona.id);
          const pending = pendingId === persona.id;

          return (
            <article className={`leaderboard-item compact ${persona.name}`} key={persona.id}>
              <div className="leaderboard-rank compact">{index + 1}</div>
              <strong className="leaderboard-name">{persona.label}</strong>
              <span className="leaderboard-count">{persona.count}</span>
              <button
                className={`like-button compact ${liked ? "liked" : ""}`}
                disabled={pending}
                onClick={() => void handleLike(persona.id)}
                type="button"
              >
                {pending ? "..." : liked ? "취소" : "좋아요"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
