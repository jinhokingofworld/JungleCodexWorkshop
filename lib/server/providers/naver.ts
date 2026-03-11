import type { EvidenceItem, SymbolProfile } from "@/lib/types";
import { logApiEvent } from "@/lib/server/logging";

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

export async function fetchNaverNewsEvidence(
  profile: SymbolProfile
): Promise<EvidenceItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    logApiEvent(
      "naver",
      "skipped",
      { symbol: profile.symbol, reason: "missing_client_credentials" },
      "warn"
    );
    return [];
  }

  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", `${profile.name} ${profile.symbol} 주식`);
  url.searchParams.set("display", "2");
  url.searchParams.set("sort", "date");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret
      }
    });

    if (!response.ok) {
      logApiEvent(
        "naver",
        "http_error",
        { symbol: profile.symbol, status: response.status },
        "warn"
      );
      return [];
    }

    const payload = (await response.json()) as {
      items?: Array<{ title: string; description: string; originallink?: string; pubDate: string }>;
    };

    const items = (payload.items ?? []).map((item, index) => ({
      id: `naver-${profile.symbol.toLowerCase()}-${index}`,
      source: "NAVER" as const,
      kind: "news" as const,
      title: stripHtml(item.title),
      url: item.originallink ?? null,
      timestamp: new Date(item.pubDate).toISOString(),
      snippet: stripHtml(item.description),
      numericSnapshot: undefined
    }));

    logApiEvent("naver", "success", {
      symbol: profile.symbol,
      count: items.length
    });

    return items;
  } catch {
    logApiEvent("naver", "network_error", { symbol: profile.symbol }, "error");
    return [];
  }
}
