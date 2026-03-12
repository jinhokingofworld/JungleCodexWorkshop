"use client";

import Link from "next/link";
import { DebateLikeButton } from "@/components/debate-like-button";
import type { SessionPreview } from "@/lib/types";

interface DebateLikeHeroListProps {
  sessions: SessionPreview[];
}

export function DebateLikeHeroList({ sessions }: DebateLikeHeroListProps) {
  return (
    <>
      <span className="mini-pill">토론 좋아요 랭킹</span>
      {sessions.map((item) => (
        <div className="mini-session mini-session-card" key={item.id}>
          <Link href={`/debates/${item.id}`}>
            <strong>
              {item.symbolName} · {item.symbol}
            </strong>
            <span>{item.overallView}</span>
          </Link>
          <DebateLikeButton compact debateId={item.id} initialLikes={item.likes} />
        </div>
      ))}
    </>
  );
}
