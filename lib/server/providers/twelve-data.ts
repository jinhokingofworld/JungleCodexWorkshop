import type { EvidenceItem, SymbolProfile } from "@/lib/types";
import { logApiEvent } from "@/lib/server/logging";

interface TwelveDataQuoteResponse {
  symbol?: string;
  name?: string;
  exchange?: string;
  currency?: string;
  datetime?: string;
  close?: string;
  volume?: string;
  percent_change?: string;
  code?: number;
  message?: string;
  status?: string;
}

function toNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function fetchTwelveDataEvidence(
  profile: SymbolProfile
): Promise<EvidenceItem | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey || profile.market !== "US") {
    logApiEvent(
      "twelvedata",
      "skipped",
      { market: profile.market, symbol: profile.symbol, reason: "missing_api_key_or_market" },
      "warn"
    );
    return null;
  }

  const url = new URL("https://api.twelvedata.com/quote");
  url.searchParams.set("symbol", profile.symbol);
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      const errorText = await response.text();
      logApiEvent(
        "twelvedata",
        "http_error",
        { symbol: profile.symbol, status: response.status, errorText },
        "warn"
      );
      return null;
    }

    const payload = (await response.json()) as TwelveDataQuoteResponse;
    if (payload.status === "error") {
      logApiEvent(
        "twelvedata",
        "api_error",
        { symbol: profile.symbol, code: payload.code ?? null, message: payload.message ?? null },
        "warn"
      );
      return null;
    }

    if (!payload.close) {
      logApiEvent("twelvedata", "empty_quote", { symbol: profile.symbol }, "warn");
      return null;
    }

    const price = toNumber(payload.close, profile.price);
    const changePct = toNumber(payload.percent_change, profile.changePct);
    const volume = toNumber(payload.volume, profile.volume);

    logApiEvent("twelvedata", "success", {
      symbol: profile.symbol,
      price,
      changePct,
      volume
    });

    return {
      id: `twelve-${profile.symbol.toLowerCase()}`,
      source: "TwelveData",
      kind: "price",
      title: `${payload.name ?? profile.name} 미국 시세`,
      url: "https://twelvedata.com/docs#tag/Price",
      timestamp: payload.datetime
        ? new Date(payload.datetime).toISOString()
        : new Date().toISOString(),
      snippet: `미국 세션 기준 ${price}달러 / 변동률 ${changePct}%`,
      numericSnapshot: {
        price,
        changePct,
        volume
      }
    };
  } catch {
    logApiEvent("twelvedata", "network_error", { symbol: profile.symbol }, "error");
    return null;
  }
}
