export type Market = "KR" | "US";

export type GuardMode = "off" | "monitor" | "enforce";

export type EvidenceKind = "price" | "news" | "filing" | "macro" | "volume";

export type PersonaName =
  | "krAnalyst"
  | "globalAnalyst"
  | "macroEconomist"
  | "valueInvestor"
  | "growthStrategist"
  | "technicalAnalyst"
  | "quantAnalyst"
  | "riskManager";

export type ExpertRole = "host" | PersonaName;

export type Sentiment = "bullish" | "neutral" | "bearish";

export interface SymbolProfile {
  market: Market;
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  currency: string;
  price: number;
  changePct: number;
  volume: number;
}

export interface MarketIndex {
  code: string;
  label: string;
  value: number;
  changePct: number;
}

export interface MarketOverview {
  region: Market;
  indices: MarketIndex[];
  movers: SymbolProfile[];
  activeSymbols: SymbolProfile[];
  recentSignals: string[];
}

export interface EvidenceItem {
  id: string;
  source: "KIS" | "TwelveData" | "NAVER" | "DART" | "MockMacro";
  kind: EvidenceKind;
  title: string;
  url: string | null;
  timestamp: string;
  snippet: string;
  numericSnapshot?: Record<string, number | string>;
}

export interface EvidenceBundle {
  symbol: SymbolProfile;
  items: EvidenceItem[];
}

export interface DebateMessage {
  id: string;
  role: ExpertRole;
  turn: number;
  speaker: string;
  text: string;
  confidence: number;
  stance: Sentiment;
  evidenceIds: string[];
  emittedAt: string;
}

export interface PersonaRecord {
  id: string;
  name: PersonaName;
  count: number;
}

export interface PersonaOption extends PersonaRecord {
  label: string;
  description: string;
}

export interface SelectedPersona {
  id: string;
  name: PersonaName;
  label: string;
}

export interface TimingSignal {
  label: string;
  priceText: string;
  reason: string;
  tone: "positive" | "caution" | "risk";
}

export interface TimingCard {
  summary: string;
  buyZone: TimingSignal;
  chaseWarning: TimingSignal;
  trimZone: TimingSignal;
  riskLine: TimingSignal;
  validUntil: string;
}

export interface FinalReport {
  overallView: string;
  bullCase: string;
  bearCase: string;
  risks: string[];
  watchPoints: string[];
  disclaimer: string;
}

export interface AnalysisSession {
  id: string;
  market: Market;
  symbol: string;
  symbolName: string;
  createdAt: string;
  replayCount: number;
  boardScore: number;
  optionalQuestion?: string;
  selectedPersonas: SelectedPersona[];
  evidence: EvidenceItem[];
  messages: DebateMessage[];
  timingCard: TimingCard;
  finalReport: FinalReport;
  overview: {
    price: number;
    changePct: number;
    exchange: string;
    sector: string;
  };
}

export interface CreateAnalysisInput {
  market: Market;
  symbol: string;
  personaIds: string[];
  userQuestion?: string;
  forceFresh?: boolean;
}

export interface GuardDecision {
  allowed: boolean;
  mode: GuardMode;
  reason?: string;
}

export interface SessionPreview {
  id: string;
  market: Market;
  symbol: string;
  symbolName: string;
  createdAt: string;
  replayCount: number;
  boardScore: number;
  overallView: string;
  summary: string;
  watchword: string[];
}
