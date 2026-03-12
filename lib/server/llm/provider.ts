import { getPersonaLlmDescription } from "@/lib/personas";
import type {
  DebateMessage,
  EvidenceBundle,
  EvidenceItem,
  FinalReport,
  PersonaName,
  PersonaOption,
  Sentiment,
  TimingCard
} from "@/lib/types";
import { appConfig } from "@/lib/server/config";
import {
  formatPrice,
  isoMinutesFromNow,
  roleLabel,
  sentimentFromChange
} from "@/lib/server/utils";
import { logApiEvent } from "@/lib/server/logging";

export interface GeneratedAnalysis {
  messages: DebateMessage[];
  timingCard: TimingCard;
  finalReport: FinalReport;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

interface LLMClient {
  generate(
    bundle: EvidenceBundle,
    personas: PersonaOption[],
    userQuestion?: string
  ): Promise<GeneratedAnalysis>;
}

interface MessageDraft {
  role: DebateMessage["role"];
  stance: Sentiment;
  confidence: number;
  text: string;
  evidenceIds: string[];
}

function rangeText(price: number, market: "KR" | "US", factor: number) {
  const currency = market === "KR" ? "KRW" : "USD";
  const lower = price * (1 - factor);
  const upper = price * (1 + factor);
  return `${formatPrice(lower, currency)} ~ ${formatPrice(upper, currency)}`;
}

function stanceSummary(stance: Sentiment) {
  switch (stance) {
    case "bullish":
      return "상승 여지는 남아 있지만 추격보다 확인 후 진입이 적절합니다.";
    case "neutral":
      return "방향성이 명확하지 않아 가격과 수급 확인이 우선입니다.";
    case "bearish":
      return "추가 조정 가능성에 대비해 방어적인 접근이 필요합니다.";
  }
}

function getEvidenceByKind(bundle: EvidenceBundle, kind: EvidenceItem["kind"]) {
  return bundle.items.find((item) => item.kind === kind) ?? null;
}

function selectEvidence(bundle: EvidenceBundle) {
  const fallback = bundle.items[0];

  return {
    price: getEvidenceByKind(bundle, "price") ?? fallback,
    news: getEvidenceByKind(bundle, "news") ?? bundle.items[1] ?? fallback,
    macro:
      getEvidenceByKind(bundle, "macro") ??
      getEvidenceByKind(bundle, "filing") ??
      bundle.items[2] ??
      fallback
  };
}

function adjustBullish(stance: Sentiment): Sentiment {
  if (stance === "bearish") {
    return "neutral";
  }

  if (stance === "neutral") {
    return "bullish";
  }

  return stance;
}

function adjustCautious(stance: Sentiment): Sentiment {
  if (stance === "bullish") {
    return "neutral";
  }

  if (stance === "neutral") {
    return "bearish";
  }

  return stance;
}

function stanceForPersona(name: PersonaName, round: 1 | 2, baseStance: Sentiment): Sentiment {
  switch (name) {
    case "krAnalyst":
      return round === 1 ? baseStance : adjustBullish(baseStance);
    case "globalAnalyst":
      return round === 1 ? adjustBullish(baseStance) : "neutral";
    case "macroEconomist":
      return round === 1 ? adjustCautious(baseStance) : "neutral";
    case "valueInvestor":
      return round === 1 ? adjustBullish(adjustCautious(baseStance)) : "neutral";
    case "growthStrategist":
      return round === 1 ? adjustBullish(baseStance) : adjustBullish(baseStance);
    case "technicalAnalyst":
      return round === 1 ? baseStance : adjustBullish(baseStance);
    case "quantAnalyst":
      return "neutral";
    case "riskManager":
      return round === 1 ? adjustCautious(baseStance) : "bearish";
  }
}

function confidenceForPersona(name: PersonaName, round: 1 | 2) {
  const base = {
    krAnalyst: 0.79,
    globalAnalyst: 0.74,
    macroEconomist: 0.72,
    valueInvestor: 0.77,
    growthStrategist: 0.75,
    technicalAnalyst: 0.73,
    quantAnalyst: 0.76,
    riskManager: 0.78
  } satisfies Record<PersonaName, number>;

  return Math.max(0.64, Math.min(0.88, base[name] - (round === 2 ? 0.02 : 0)));
}

interface QuestionContext {
  summary: string;
  keywordText: string;
  openingLine: string;
  globalPrompt: string;
  macroPrompt: string;
  finalAnswer: string;
}

function normalizeQuestion(userQuestion?: string) {
  return userQuestion?.replace(/\s+/g, " ").trim().replace(/[?!.]+$/u, "") ?? "";
}

function trimQuestionToken(token: string) {
  return token
    .replace(/[^0-9A-Za-z가-힣]/gu, "")
    .replace(/(있을지도|생각해줘|봐줘|알려줘|해주세요|해줘|어떨까|있는지|인지|일지)$/u, "")
    .replace(/(으로|에게|에서|부터|까지|라고|이라|가|이|은|는|을|를|와|과|도|로|의|에)$/u, "");
}

function extractQuestionKeywords(userQuestion?: string) {
  const normalized = normalizeQuestion(userQuestion);
  if (!normalized) {
    return [];
  }

  const stopwords = new Set(["이번", "질문", "토론", "분석", "기준", "포인트", "관련"]);

  return normalized
    .split(/\s+/)
    .map(trimQuestionToken)
    .filter((token) => token.length >= 2 && !stopwords.has(token))
    .filter((token, index, tokens) => tokens.indexOf(token) === index)
    .slice(0, 3);
}

function buildQuestionContext(bundle: EvidenceBundle, userQuestion?: string): QuestionContext | null {
  const summary = normalizeQuestion(userQuestion);
  if (!summary) {
    return null;
  }

  const keywordText = extractQuestionKeywords(summary).join(" · ") || summary;
  const isGeopolitical = /전쟁|지정학|분쟁|충돌|제재|관세|중동|러시아|우크라|대만/u.test(summary);

  return {
    summary,
    keywordText,
    openingLine: isGeopolitical
      ? `특히 "${summary}" 질문을 기준으로 지정학 변수, 공급망, 환율 영향까지 함께 보겠습니다.`
      : `특히 "${summary}" 질문을 기준으로 직접 영향과 간접 파급 경로를 함께 보겠습니다.`,
    globalPrompt: isGeopolitical
      ? `${keywordText} 이슈가 커지면 글로벌 반도체 밸류체인과 위험자산 선호가 함께 흔들릴 수 있습니다.`
      : `${keywordText} 질문은 해외 피어 밸류에이션과 투자심리가 어떻게 연결되는지까지 확인해야 합니다.`,
    macroPrompt: isGeopolitical
      ? `${keywordText} 변수는 환율, 에너지 가격, 정책 불확실성을 통해 할인율에 간접 반영될 가능성이 큽니다.`
      : `${keywordText} 질문은 금리, 환율, 정책 이벤트 같은 거시 채널을 통해 실제 가격에 반영되는지 봐야 합니다.`,
    finalAnswer: isGeopolitical
      ? `${bundle.symbol.name}과 ${keywordText}의 연결은 직접 전쟁 수혜나 피해보다 환율, 공급망, 메모리 수요 기대, 외국인 위험회피 심리를 통한 간접 영향이 더 큽니다. 따라서 관련 뉴스가 커질 때는 지정학 제목 자체보다 실적 가이던스, 수급, 환율이 같이 흔들리는지 확인하는 편이 더 중요합니다.`
      : `"${summary}" 질문에 답하면, ${bundle.symbol.name}은 해당 이슈가 실적, 수급, 밸류에이션 중 어느 경로로 실제 반영되는지까지 확인해야 판단 정확도가 올라갑니다. 단일 뉴스보다 공시, 가격 흐름, 거래량이 같이 움직이는지 보는 편이 좋습니다.`
  };
}

function buildPersonaText(
  persona: PersonaOption,
  bundle: EvidenceBundle,
  round: 1 | 2,
  questionContext: QuestionContext | null = null
) {
  const { symbol } = bundle;
  const evidence = selectEvidence(bundle);
  const buyRange = rangeText(symbol.price, symbol.market, 0.015);
  const wideRange = rangeText(symbol.price, symbol.market, 0.03);

  switch (persona.name) {
    case "krAnalyst":
      return round === 1
        ? {
            text: `${evidence.price.snippet} 국내 투자자 관점에서는 ${buyRange} 구간이 첫 판단선입니다. 거래대금이 유지되면 단기 수급 우위가 이어질 수 있습니다.`,
            evidenceIds: [evidence.price.id]
          }
        : {
            text: `국내 수급이 꺾이는지와 공시 모멘텀이 이어지는지를 함께 봐야 합니다. 가격이 급하게 ${wideRange} 바깥으로 치솟으면 추격보다 눌림 확인이 더 합리적입니다.`,
            evidenceIds: [evidence.price.id, evidence.macro.id]
          };
    case "globalAnalyst":
      return round === 1
        ? {
            text: `${questionContext ? `${questionContext.globalPrompt} ` : ""}${evidence.news.snippet} 해외 피어와 비교하면 지금은 과열 추격보다 상대 밸류에이션 확인 구간에 가깝습니다. 달러 강세와 외국인 흐름도 같이 봐야 합니다.`,
            evidenceIds: [evidence.news.id]
          }
        : {
            text: `${questionContext ? `${questionContext.keywordText} 기준으로 보면 글로벌 투자심리와 반도체 멀티플이 동시에 흔들릴 수 있습니다. ` : ""}같은 섹터의 글로벌 리더가 강한 멀티플을 유지한다면 상단 재평가도 가능합니다. 다만 해외 기술주 변동성이 커지면 국내외 모두 할인율이 빠르게 올라갈 수 있습니다.`,
            evidenceIds: [evidence.news.id, evidence.macro.id]
          };
    case "macroEconomist":
      return round === 1
        ? {
            text: `${questionContext ? `${questionContext.macroPrompt} ` : ""}${evidence.macro.snippet} 금리와 환율이 동시에 흔들리면 개별 종목의 좋은 재료도 할인될 수 있습니다. 이번 토론에서는 거시 변수 확인이 먼저입니다.`,
            evidenceIds: [evidence.macro.id]
          }
        : {
            text: `${questionContext ? `${questionContext.keywordText} 관련 노이즈가 커질수록 환율과 정책 이벤트를 먼저 봐야 합니다. ` : ""}유동성 환경이 안정적이면 현재 변동성은 흡수될 수 있지만, 정책 이벤트 전후에는 보수적인 비중 조절이 필요합니다. 매크로 노이즈가 커질수록 진입 타이밍은 뒤로 미루는 편이 낫습니다.`,
            evidenceIds: [evidence.macro.id]
          };
    case "valueInvestor":
      return round === 1
        ? {
            text: `가치 관점에서는 현재 가격이 무엇을 이미 반영했는지가 중요합니다. ${buyRange} 안에서 안전마진이 확인되면 장기 관찰 리스트에서 실전 후보로 옮길 수 있습니다.`,
            evidenceIds: [evidence.price.id, evidence.macro.id]
          }
        : {
            text: `좋은 기업이라도 비싼 가격에서는 기대수익률이 낮아집니다. 실적 확인 전 과도한 프리미엄이 붙으면 매수보다 기다림의 가치가 커집니다.`,
            evidenceIds: [evidence.price.id]
          };
    case "growthStrategist":
      return round === 1
        ? {
            text: `${symbol.name}의 핵심은 단기 가격보다 성장 지속성입니다. 실적 가속과 시장 점유율 확장 신호가 이어진다면 현재 구간은 성장주 관점에서 재평가 초입일 수 있습니다.`,
            evidenceIds: [evidence.news.id, evidence.macro.id]
          }
        : {
            text: `성장주는 기대가 꺾이는 순간 조정 폭도 커집니다. 다음 분기 가이던스와 신규 모멘텀이 약해지면 프리미엄을 오래 방어하기 어렵습니다.`,
            evidenceIds: [evidence.news.id]
          };
    case "technicalAnalyst":
      return round === 1
        ? {
            text: `차트로 보면 현재 가격대는 ${buyRange} 부근의 지지 확인이 핵심입니다. 거래량이 붙는 상승과 그렇지 않은 반등은 전혀 다른 신호로 봐야 합니다.`,
            evidenceIds: [evidence.price.id]
          }
        : {
            text: `상단 저항을 한 번에 돌파하지 못하면 박스권 재진입 가능성도 열어둬야 합니다. 기술적으로는 ${wideRange} 안에서 눌림 후 재시도 여부를 보는 편이 안전합니다.`,
            evidenceIds: [evidence.price.id]
          };
    case "quantAnalyst":
      return round === 1
        ? {
            text: `수치 신호만 보면 최근 변동성은 높지만 아직 완전한 이탈 패턴으로 보기는 어렵습니다. 팩터 관점에서는 추세와 평균회귀 신호가 혼재해 있어 분할 접근이 맞습니다.`,
            evidenceIds: [evidence.price.id, evidence.news.id]
          }
        : {
            text: `확률적으로는 이벤트 직후의 과열 구간보다 확인 이후의 재진입이 손익비가 더 좋습니다. 이번 케이스도 단일 가격이 아니라 구간별 대응으로 모델링하는 편이 유리합니다.`,
            evidenceIds: [evidence.price.id]
          };
    case "riskManager":
      return round === 1
        ? {
            text: `좋은 시나리오보다 먼저 봐야 할 것은 손실 통제선입니다. ${rangeText(symbol.price, symbol.market, 0.04)} 아래로 흐름이 무너지면 빠른 재평가가 필요합니다.`,
            evidenceIds: [evidence.price.id, evidence.macro.id]
          }
        : {
            text: `이번 토론의 핵심 리스크는 거시 변수와 기대치 훼손입니다. 포지션을 잡더라도 분할 진입과 명확한 손절 기준 없이 접근하면 변동성을 버티기 어렵습니다.`,
            evidenceIds: [evidence.macro.id]
          };
  }
}
function createMockMessages(
  bundle: EvidenceBundle,
  personas: PersonaOption[],
  userQuestion?: string
): DebateMessage[] {
  const baseStance = sentimentFromChange(bundle.symbol.changePct);
  const openingEvidence = selectEvidence(bundle);
  const personaLabels = personas.map((persona) => persona.label).join(", ");
  const questionContext = buildQuestionContext(bundle, userQuestion);

  const drafts: MessageDraft[] = [
    {
      role: "host",
      stance: "neutral",
      confidence: 0.78,
      text: questionContext
        ? `${bundle.symbol.name}의 토론을 시작하겠습니다. 오늘은 ${personaLabels} 조합으로 가격, 수급, 거시 변수, 리스크를 나눠서 점검하겠습니다. ${questionContext.openingLine}`
        : `${bundle.symbol.name}의 토론을 시작하겠습니다. 오늘은 ${personaLabels} 조합으로 가격, 수급, 거시 변수, 리스크를 나눠서 점검하겠습니다.`,
      evidenceIds: questionContext
        ? [openingEvidence.price.id, openingEvidence.news.id, openingEvidence.macro.id]
        : [openingEvidence.price.id]
    },
    ...personas.map((persona) => {
      const commentary = buildPersonaText(persona, bundle, 1, questionContext);

      return {
        role: persona.name,
        stance: stanceForPersona(persona.name, 1, baseStance),
        confidence: confidenceForPersona(persona.name, 1),
        text: commentary.text,
        evidenceIds: commentary.evidenceIds
      } satisfies MessageDraft;
    }),
    ...personas.map((persona) => {
      const commentary = buildPersonaText(persona, bundle, 2, questionContext);

      return {
        role: persona.name,
        stance: stanceForPersona(persona.name, 2, baseStance),
        confidence: confidenceForPersona(persona.name, 2),
        text: commentary.text,
        evidenceIds: commentary.evidenceIds
      } satisfies MessageDraft;
    }),
    {
      role: "host",
      stance: "neutral",
      confidence: 0.82,
      text: questionContext
        ? `정리하면 ${stanceSummary(baseStance)} 질문 기준으로는 ${questionContext.finalAnswer}`
        : `정리하면 ${stanceSummary(baseStance)} 오늘 결론은 추격보다 근거를 확인하며 구간 대응하는 접근이 적절하다는 쪽에 가깝습니다.`,
      evidenceIds: [openingEvidence.price.id, openingEvidence.news.id, openingEvidence.macro.id]
    }
  ];

  return drafts.map((draft, index) => ({
    id: `${bundle.symbol.market.toLowerCase()}-${bundle.symbol.symbol.toLowerCase()}-${index + 1}`,
    role: draft.role,
    speaker: roleLabel(draft.role),
    turn: index + 1,
    text: draft.text,
    confidence: draft.confidence,
    stance: draft.stance,
    evidenceIds: draft.evidenceIds,
    emittedAt: new Date(Date.now() + index * 1_000).toISOString()
  }));
}
function createTimingCard(bundle: EvidenceBundle): TimingCard {
  const { symbol } = bundle;
  const currency = symbol.market === "KR" ? "KRW" : "USD";

  return {
    summary:
      symbol.changePct >= 0
        ? "추격보다 눌림 확인 후 분할 접근이 유리한 구간입니다."
        : "하락 진정 여부를 확인한 뒤 방어적으로 접근하는 편이 유리합니다.",
    buyZone: {
      label: "매수 관심 구간",
      priceText: rangeText(symbol.price, symbol.market, 0.012),
      reason: "지지 구간에서 거래량이 받쳐주면 진입 명분이 강화됩니다.",
      tone: "positive"
    },
    chaseWarning: {
      label: "추격 매수 경계 구간",
      priceText: rangeText(symbol.price, symbol.market, 0.035),
      reason: "단기 과열 구간에서는 기대수익 대비 리스크가 더 빠르게 커집니다.",
      tone: "caution"
    },
    trimZone: {
      label: "분할 매도 고려 구간",
      priceText: formatPrice(symbol.price * 1.05, currency),
      reason: "단기 목표 수익을 일부 반영하고 다음 시그널을 기다리는 구간입니다.",
      tone: "positive"
    },
    riskLine: {
      label: "손절/리스크 관리 구간",
      priceText: formatPrice(symbol.price * 0.96, currency),
      reason: "이 구간이 무너지면 현재 시나리오를 다시 점검해야 합니다.",
      tone: "risk"
    },
    validUntil: isoMinutesFromNow(180)
  };
}

function createFinalReport(bundle: EvidenceBundle, userQuestion?: string): FinalReport {
  const { symbol } = bundle;
  const stance = sentimentFromChange(symbol.changePct);
  const questionContext = buildQuestionContext(bundle, userQuestion);

  return {
    overallView:
      stance === "bullish"
        ? `${symbol.name}은 단기 모멘텀이 살아 있지만 추격보다 눌림 확인 뒤 분할 접근이 더 적절합니다.`
        : stance === "bearish"
          ? `${symbol.name}은 단기 변동성이 큰 편이라 성급한 진입보다 확인 후 대응이 필요합니다.`
          : `${symbol.name}은 방향성이 아직 완전히 열리지 않아 구간 대응과 체크포인트 점검이 우선입니다.`,
    questionAnswer: questionContext?.finalAnswer,
    bullCase:
      "수급 개선, 피어 밸류에이션 확장, 추가 뉴스 또는 공시가 이어지면 단기 재평가 구간이 열릴 수 있습니다.",
    bearCase:
      "거래대금 둔화, 기대치 하향, 매크로 변동성 확대가 겹치면 조정 폭이 예상보다 길어질 수 있습니다.",
    risks: [
      "실적 또는 가이던스가 기대치를 밑돌 수 있습니다.",
      "금리, 환율, 유동성 같은 거시 변수 변화가 밸류에이션에 직접 영향을 줄 수 있습니다.",
      "변동성이 큰 구간에서는 추격 진입의 손익비가 빠르게 악화될 수 있습니다."
    ],
    watchPoints: [
      "직전 고점 돌파 여부와 거래량 동반 여부",
      "뉴스와 공시가 기존 기대를 강화하는지 여부",
      "장 마감 전후 수급 흐름이 유지되는지 여부"
    ],
    disclaimer:
      "이 정보는 참고용 분석이며 특정 종목의 매수 또는 매도를 권유하지 않습니다."
  };
}
function createOutputSchema(personas: PersonaOption[]) {
  const allowedRoles = ["host", ...personas.map((persona) => persona.name)];
  const expectedMessageCount = personas.length * 2 + 2;

  return {
    name: "stock_debate_analysis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        messages: {
          type: "array",
          minItems: expectedMessageCount,
          maxItems: expectedMessageCount,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              role: {
                type: "string",
                enum: allowedRoles
              },
              speaker: { type: "string" },
              stance: {
                type: "string",
                enum: ["bullish", "neutral", "bearish"]
              },
              confidence: { type: "number" },
              text: { type: "string" },
              evidenceIds: {
                type: "array",
                minItems: 1,
                items: { type: "string" }
              }
            },
            required: ["role", "speaker", "stance", "confidence", "text", "evidenceIds"]
          }
        },
        timingCard: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            buyZone: { $ref: "#/$defs/timingSignal" },
            chaseWarning: { $ref: "#/$defs/timingSignal" },
            trimZone: { $ref: "#/$defs/timingSignal" },
            riskLine: { $ref: "#/$defs/timingSignal" },
            validUntil: { type: "string" }
          },
          required: [
            "summary",
            "buyZone",
            "chaseWarning",
            "trimZone",
            "riskLine",
            "validUntil"
          ]
        },
        finalReport: {
          type: "object",
          additionalProperties: false,
          properties: {
            overallView: { type: "string" },
            questionAnswer: { type: "string" },
            bullCase: { type: "string" },
            bearCase: { type: "string" },
            risks: { type: "array", items: { type: "string" } },
            watchPoints: { type: "array", items: { type: "string" } },
            disclaimer: { type: "string" }
          },
          required: [
            "overallView",
            "bullCase",
            "bearCase",
            "risks",
            "watchPoints",
            "disclaimer"
          ]
        }
      },
      required: ["messages", "timingCard", "finalReport"],
      $defs: {
        timingSignal: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            priceText: { type: "string" },
            reason: { type: "string" },
            tone: {
              type: "string",
              enum: ["positive", "caution", "risk"]
            }
          },
          required: ["label", "priceText", "reason", "tone"]
        }
      }
    }
  } as const;
}
function toJsonText(
  content: string | Array<{ type?: string; text?: string }> | undefined
) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text)
      .join("");
  }

  return "";
}

function buildPrompt(bundle: EvidenceBundle, personas: PersonaOption[], userQuestion?: string) {
  const evidenceText = bundle.items
    .map(
      (item) =>
        `- ${item.id} | ${item.source} | ${item.kind} | ${item.title} | ${item.snippet}`
    )
    .join("\n");

  const personaText = personas
    .map(
      (persona, index) =>
        `${index + 1}. ${persona.label} (${persona.name}) - ${getPersonaLlmDescription(persona.name)}`
    )
    .join("\n");

  const sequence = ["host", ...personas.map((persona) => persona.name), ...personas.map((persona) => persona.name), "host"].join(
    " -> "
  );

  const questionInstructions = userQuestion
    ? [
        `User question: ${normalizeQuestion(userQuestion)}`,
        "The host opening message must briefly restate or summarize the user question in Korean.",
        "If globalAnalyst is selected, every globalAnalyst message must directly address the user question and mention at least one keyword from it.",
        "If macroEconomist is selected, every macroEconomist message must directly address the user question and mention at least one keyword from it.",
        "When a user question exists, finalReport.questionAnswer must directly answer that question in 2-3 Korean sentences."
      ]
    : [
        "User question: none",
        "When there is no user question, omit finalReport.questionAnswer."
      ];

  return [
    "Return JSON only and write every natural-language field in Korean.",
    "Use the selected personas to generate a stock debate plus timing card and final report.",
    `Generate exactly ${personas.length * 2 + 2} debate messages.`,
    `Follow this exact role order: ${sequence}.`,
    "Use only the allowed roles from the schema.",
    "Each message should be 1-2 sentences and grounded in the provided evidence.",
    "evidenceIds must only use the provided evidence item ids.",
    "The host should open the debate, keep it structured, and end with a balanced conclusion.",
    `Symbol: ${bundle.symbol.name} (${bundle.symbol.symbol})`,
    `Market: ${bundle.symbol.market}`,
    `Current price: ${bundle.symbol.price}`,
    `Change pct: ${bundle.symbol.changePct}%`,
    `Sector: ${bundle.symbol.sector}`,
    ...questionInstructions,
    "Selected personas:",
    personaText,
    "Evidence:",
    evidenceText
  ].join("\n");
}
function normalizeGeneratedAnalysis(
  payload: GeneratedAnalysis,
  bundle: EvidenceBundle
) {
  return {
    messages: payload.messages.map((message, index) => ({
      ...message,
      speaker: roleLabel(message.role),
      id: `${bundle.symbol.market.toLowerCase()}-${bundle.symbol.symbol.toLowerCase()}-${index + 1}`,
      turn: index + 1,
      emittedAt: new Date(Date.now() + index * 1_000).toISOString()
    })),
    timingCard: payload.timingCard,
    finalReport: payload.finalReport
  };
}

class MockLLMClient implements LLMClient {
  async generate(
    bundle: EvidenceBundle,
    personas: PersonaOption[],
    userQuestion?: string
  ): Promise<GeneratedAnalysis> {
    return {
      messages: createMockMessages(bundle, personas, userQuestion),
      timingCard: createTimingCard(bundle),
      finalReport: createFinalReport(bundle, userQuestion)
    };
  }
}
class OpenAILLMClient implements LLMClient {
  async generate(
    bundle: EvidenceBundle,
    personas: PersonaOption[],
    userQuestion?: string
  ): Promise<GeneratedAnalysis> {
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) {
      logApiEvent("openai", "missing_api_key", {}, "warn");
      throw new Error("LLM_API_KEY is missing");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: appConfig.llmModel,
        temperature: 0.7,
        response_format: {
          type: "json_schema",
          json_schema: createOutputSchema(personas)
        },
        messages: [
          {
            role: "system",
            content:
              "You are an AI stock debate engine. Return valid JSON that follows the provided schema exactly."
          },
          {
            role: "user",
            content: buildPrompt(bundle, personas, userQuestion)
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logApiEvent(
        "openai",
        "http_error",
        { status: response.status, errorText },
        "warn"
      );
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as OpenAIChatCompletionResponse;
    const rawText = toJsonText(payload.choices?.[0]?.message?.content);
    if (!rawText) {
      logApiEvent("openai", "empty_content", {}, "warn");
      throw new Error("OpenAI returned empty content");
    }

    logApiEvent("openai", "success", {
      model: appConfig.llmModel,
      contentLength: rawText.length
    });

    return normalizeGeneratedAnalysis(
      JSON.parse(rawText) as GeneratedAnalysis,
      bundle
    );
  }
}

function createClient(): LLMClient {
  if (appConfig.llmProvider === "mock") {
    return new MockLLMClient();
  }

  if (appConfig.llmProvider === "openai") {
    return new OpenAILLMClient();
  }

  return new MockLLMClient();
}

export async function generateStructuredAnalysis(
  bundle: EvidenceBundle,
  personas: PersonaOption[],
  userQuestion?: string
) {
  const client = createClient();

  try {
    return await client.generate(bundle, personas, userQuestion);
  } catch (error) {
    logApiEvent(
      "openai",
      "fallback_to_mock",
      {
        model: appConfig.llmModel,
        message: error instanceof Error ? error.message : "unknown_error"
      },
      "warn"
    );

    return new MockLLMClient().generate(bundle, personas, userQuestion);
  }
}
