import type { EvidenceItem, SymbolProfile } from "@/lib/types";

const corpCodeBySymbol: Record<string, string> = {
  "005930": "00126380"
};

export async function fetchDartEvidence(
  profile: SymbolProfile
): Promise<EvidenceItem[]> {
  const apiKey = process.env.OPEN_DART_API_KEY;
  const corpCode = corpCodeBySymbol[profile.symbol];

  if (!apiKey || profile.market !== "KR" || !corpCode) {
    return [];
  }

  const today = new Date();
  const start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const format = (date: Date) =>
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;

  const url = new URL("https://opendart.fss.or.kr/api/list.json");
  url.searchParams.set("crtfc_key", apiKey);
  url.searchParams.set("corp_code", corpCode);
  url.searchParams.set("bgn_de", format(start));
  url.searchParams.set("end_de", format(today));
  url.searchParams.set("page_count", "2");

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      list?: Array<{ report_nm: string; rcept_dt: string; corp_name: string; flr_nm?: string }>;
    };

    return (payload.list ?? []).map((item, index) => ({
      id: `dart-${profile.symbol.toLowerCase()}-${index}`,
      source: "DART" as const,
      kind: "filing" as const,
      title: item.report_nm,
      url: "https://opendart.fss.or.kr/",
      timestamp: new Date(
        `${item.rcept_dt.slice(0, 4)}-${item.rcept_dt.slice(4, 6)}-${item.rcept_dt.slice(6, 8)}`
      ).toISOString(),
      snippet: `${item.corp_name} 관련 공시가 최근 30일 내 접수되었습니다.`,
      numericSnapshot: undefined
    }));
  } catch {
    return [];
  }
}
