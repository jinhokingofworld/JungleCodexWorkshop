import type { MarketOverview, SymbolProfile } from "@/lib/types";

export const symbolCatalog: SymbolProfile[] = [
  {
    market: "KR",
    symbol: "005930",
    name: "삼성전자",
    exchange: "KOSPI",
    sector: "반도체",
    currency: "KRW",
    price: 74800,
    changePct: 1.82,
    volume: 18420311
  },
  {
    market: "KR",
    symbol: "000660",
    name: "SK하이닉스",
    exchange: "KOSPI",
    sector: "반도체",
    currency: "KRW",
    price: 202500,
    changePct: 2.34,
    volume: 3955210
  },
  {
    market: "KR",
    symbol: "035420",
    name: "NAVER",
    exchange: "KOSPI",
    sector: "인터넷",
    currency: "KRW",
    price: 214500,
    changePct: -0.48,
    volume: 1038211
  },
  {
    market: "KR",
    symbol: "005380",
    name: "현대차",
    exchange: "KOSPI",
    sector: "자동차",
    currency: "KRW",
    price: 254000,
    changePct: 0.91,
    volume: 843220
  },
  {
    market: "US",
    symbol: "NVDA",
    name: "NVIDIA",
    exchange: "NASDAQ",
    sector: "Semiconductor",
    currency: "USD",
    price: 129.84,
    changePct: 2.91,
    volume: 451203210
  },
  {
    market: "US",
    symbol: "TSLA",
    name: "Tesla",
    exchange: "NASDAQ",
    sector: "EV",
    currency: "USD",
    price: 218.42,
    changePct: -1.62,
    volume: 132410210
  },
  {
    market: "US",
    symbol: "AAPL",
    name: "Apple",
    exchange: "NASDAQ",
    sector: "Consumer Tech",
    currency: "USD",
    price: 226.13,
    changePct: 0.74,
    volume: 82214420
  },
  {
    market: "US",
    symbol: "MSFT",
    name: "Microsoft",
    exchange: "NASDAQ",
    sector: "Cloud",
    currency: "USD",
    price: 418.74,
    changePct: 1.19,
    volume: 32184220
  }
];

export const marketOverviewCatalog: Record<"KR" | "US", MarketOverview> = {
  KR: {
    region: "KR",
    indices: [
      { code: "KOSPI", label: "코스피", value: 2712.41, changePct: 0.92 },
      { code: "KOSDAQ", label: "코스닥", value: 864.28, changePct: 0.61 },
      { code: "KRW", label: "원/달러", value: 1326.4, changePct: -0.22 }
    ],
    movers: symbolCatalog.filter((item) => item.market === "KR").slice(0, 3),
    activeSymbols: symbolCatalog.filter((item) => item.market === "KR"),
    recentSignals: [
      "반도체 업종이 외국인 순매수와 함께 강세입니다.",
      "대형주 중심으로 거래대금이 집중되고 있습니다.",
      "공시 모멘텀이 있는 종목은 장중 변동성이 커질 수 있습니다."
    ]
  },
  US: {
    region: "US",
    indices: [
      { code: "NASDAQ", label: "나스닥", value: 18344.52, changePct: 1.21 },
      { code: "S&P500", label: "S&P 500", value: 5296.18, changePct: 0.73 },
      { code: "US10Y", label: "미 10년물", value: 4.12, changePct: -0.31 }
    ],
    movers: symbolCatalog.filter((item) => item.market === "US").slice(0, 3),
    activeSymbols: symbolCatalog.filter((item) => item.market === "US"),
    recentSignals: [
      "빅테크가 금리 안정 기대와 함께 반등하고 있습니다.",
      "AI 인프라 수요가 반도체 밸류에이션을 지지하고 있습니다.",
      "소비재와 고베타 종목은 실적 시즌 기대치에 민감합니다."
    ]
  }
};

export function findSymbol(market: "KR" | "US", symbol: string) {
  return symbolCatalog.find(
    (item) =>
      item.market === market && item.symbol.toLowerCase() === symbol.toLowerCase()
  );
}
