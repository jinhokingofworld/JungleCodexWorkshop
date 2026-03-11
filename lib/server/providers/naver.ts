import type { EvidenceItem, SymbolProfile } from "@/lib/types";

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "");
}

export async function fetchNaverNewsEvidence(
  profile: SymbolProfile
): Promise<EvidenceItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
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
      return [];
    }

    const payload = (await response.json()) as {
      items?: Array<{ title: string; description: string; originallink?: string; pubDate: string }>;
    };

    return (payload.items ?? []).map((item, index) => ({
      id: `naver-${profile.symbol.toLowerCase()}-${index}`,
      source: "NAVER" as const,
      kind: "news" as const,
      title: stripHtml(item.title),
      url: item.originallink ?? null,
      timestamp: new Date(item.pubDate).toISOString(),
      snippet: stripHtml(item.description),
      numericSnapshot: undefined
    }));
  } catch {
    return [];
  }
}
