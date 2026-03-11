import { getPresetPersonaById } from "@/lib/personas";
import type { ExpertRole, Market, Sentiment, SymbolProfile } from "@/lib/types";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatPrice(value: number, currency: string) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2
  }).format(value);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function roleLabel(role: ExpertRole) {
  return getPresetPersonaById(`preset-${role}`)?.name ?? role;
}

export function roleAccent(role: ExpertRole) {
  return getPresetPersonaById(`preset-${role}`)?.visualTone.accent ?? "#334155";
}

export function stanceLabel(stance: Sentiment) {
  switch (stance) {
    case "bullish":
      return "긍정";
    case "neutral":
      return "중립";
    case "bearish":
      return "보수";
  }
}

export function symbolPath(market: Market, symbol: string) {
  return `/stocks/${market.toLowerCase()}/${symbol.toLowerCase()}`;
}

export function pickWatchwords(profile: SymbolProfile) {
  const sectorTags =
    profile.market === "KR"
      ? ["수급", "공시", profile.sector]
      : ["실적", "금리", profile.sector];
  return sectorTags.slice(0, 3);
}

export function sentimentFromChange(changePct: number): Sentiment {
  if (changePct >= 1.2) {
    return "bullish";
  }

  if (changePct <= -1.0) {
    return "bearish";
  }

  return "neutral";
}

export function seededNumber(seed: string, min: number, max: number) {
  const hash = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const ratio = (Math.sin(hash) + 1) / 2;
  return min + (max - min) * ratio;
}

export function isoMinutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}
