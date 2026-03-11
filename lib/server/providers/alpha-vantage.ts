import type { EvidenceItem, SymbolProfile } from "@/lib/types";
import { logApiEvent } from "@/lib/server/logging";

export async function fetchAlphaVantageEvidence(
  profile: SymbolProfile
): Promise<EvidenceItem | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey || profile.market !== "US") {
    logApiEvent(
      "alphavantage",
      "skipped",
      { market: profile.market, symbol: profile.symbol, reason: "missing_api_key_or_market" },
      "warn"
    );
    return null;
  }

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", profile.symbol);
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      logApiEvent(
        "alphavantage",
        "http_error",
        { symbol: profile.symbol, status: response.status },
        "warn"
      );
      return null;
    }

    const payload = (await response.json()) as {
      "Global Quote"?: Record<string, string>;
    };

    const quote = payload["Global Quote"];
    if (!quote) {
      logApiEvent(
        "alphavantage",
        "empty_quote",
        { symbol: profile.symbol },
        "warn"
      );
      return null;
    }

    logApiEvent("alphavantage", "success", {
      symbol: profile.symbol,
      price: quote["05. price"] ?? null,
      changePct: quote["10. change percent"] ?? null
    });

    return {
      id: `alpha-${profile.symbol.toLowerCase()}`,
      source: "AlphaVantage",
      kind: "price",
      title: `${profile.name} 글로벌 시세`,
      url: "https://www.alphavantage.co/documentation/",
      timestamp: new Date().toISOString(),
      snippet: `미국 세션 기준 ${quote["05. price"] ?? "N/A"} / 변동률 ${quote["10. change percent"] ?? "N/A"}`,
      numericSnapshot: {
        price: Number(quote["05. price"] ?? profile.price),
        changePct: Number.parseFloat(
          (quote["10. change percent"] ?? `${profile.changePct}%`).replace("%", "")
        ),
        volume: Number(quote["06. volume"] ?? profile.volume)
      }
    };
  } catch {
    logApiEvent(
      "alphavantage",
      "network_error",
      { symbol: profile.symbol },
      "error"
    );
    return null;
  }
}
