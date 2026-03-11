"use client";

import { useEffect, useState } from "react";
import {
  hasLikedDebate,
  markDebateLiked,
  unmarkDebateLiked
} from "@/lib/likes";

interface DebateLikeButtonProps {
  debateId: string;
  initialLikes: number;
  compact?: boolean;
}

export function DebateLikeButton({
  debateId,
  initialLikes,
  compact = false
}: DebateLikeButtonProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setLikes(initialLikes);
    setLiked(hasLikedDebate(debateId));
  }, [debateId, initialLikes]);

  async function handleLike() {
    if (pending) {
      return;
    }

    const shouldUnlike = liked;
    setPending(true);
    setLikes((current) => Math.max(0, current + (shouldUnlike ? -1 : 1)));

    try {
      const response = await fetch(`/api/debates/${debateId}/like`, {
        method: shouldUnlike ? "DELETE" : "POST"
      });
      const payload = (await response.json()) as { likes?: number; error?: string };
      if (!response.ok || typeof payload.likes !== "number") {
        throw new Error(payload.error ?? "Failed to toggle debate like.");
      }

      if (shouldUnlike) {
        unmarkDebateLiked(debateId);
      } else {
        markDebateLiked(debateId);
      }

      setLiked(!shouldUnlike);
      setLikes(payload.likes);
    } catch {
      setLikes(initialLikes);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className={`like-button ${compact ? "compact" : ""} ${liked ? "liked" : ""}`}
      disabled={pending}
      onClick={() => void handleLike()}
      type="button"
    >
      {compact
        ? `${liked ? "취소" : "좋아요"} ${likes}`
        : `${liked ? "좋아요 취소" : "좋아요"} ${likes}`}
    </button>
  );
}
