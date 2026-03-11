import type {
  DebateMessage,
  EvidenceBundle,
  FinalReport,
  SelectedPersona,
  Sentiment,
  TimingCard
} from "@/lib/types";
import { HOST_PERSONA_ID } from "@/lib/personas";
import { appConfig } from "@/lib/server/config";
import { formatPrice, isoMinutesFromNow, sentimentFromChange } from "@/lib/server/utils";

interface RawGeneratedMessage {
  speakerPersonaId: string;
  stance: Sentiment;
  confidence: number;
  text: string;
  evidenceIds: string[];
}

export interface GeneratedAnalysis {
  messages: RawGeneratedMessage[];
  timingCard: TimingCard;
  finalReport: FinalReport;
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
      return "단기 모멘텀은 긍정적이지만 추격보다는 눌림 확인이 유리합니다.";
    case "neutral":
      return "방향이 완전히 확인되지 않아 구간 대응이 적절합니다.";
    case "bearish":
      return "추가 조정 가능성을 열어두고 보수적으로 접근하는 편이 안전합니다.";
  }
}

function personaAngle(persona: SelectedPersona) {
  const name = persona.name;

  if (persona.id === HOST_PERSONA_ID) {
    return "쟁점을 정리하고 참가자들의 의견을 연결";
  }

  if (persona.presetRole === "krAnalyst") {
    return "국내 수급과 공시 흐름을 중심으로 해석";
  }

  if (persona.presetRole === "globalAnalyst") {
    return "글로벌 비교와 밸류에이션 관점으로 판단";
  }

  if (persona.presetRole === "macroEconomist") {
    return "거시 환경과 금리 변수를 점검";
  }

  if (persona.presetRole === "technicalAnalyst") {
    return "차트와 거래량, 수급 타이밍을 우선 확인";
  }

  if (persona.presetRole === "valueAnalyst") {
    return "실적과 밸류에이션을 중심으로 적정 가치를 검토";
  }

  if (persona.presetRole === "riskManager") {
    return "실패 시나리오와 하방 리스크를 우선 통제";
  }

  if (persona.presetRole === "sectorSpecialist") {
    return "산업 변화와 경쟁 구도를 우선 파악";
  }

  return `${name}의 커스텀 프레임으로 핵심 근거를 요약`;
}

function createMockMessages(bundle: EvidenceBundle, personas: SelectedPersona[]): RawGeneratedMessage[] {
  const { symbol, items } = bundle;
  const [priceEvidence, newsEvidence, filingEvidence, macroEvidence] = items;
  const stance = sentimentFromChange(symbol.changePct);
  const participants = personas.filter((persona) => persona.id !== HOST_PERSONA_ID);
  const host = personas.find((persona) => persona.id === HOST_PERSONA_ID) ?? personas[0];
  const baseIds = [priceEvidence?.id, newsEvidence?.id, filingEvidence?.id].filter(
    (value): value is string => Boolean(value)
  );

  const drafts: RawGeneratedMessage[] = [
    {
      speakerPersonaId: host.id,
      stance: "neutral",
      confidence: 0.73,
      text: `${symbol.name} 토론을 시작합니다. 오늘은 가격 흐름, 뉴스, 공시, 거시 변수 중 무엇이 더 중요한지 중심 쟁점을 짚겠습니다.`,
      evidenceIds: baseIds.slice(0, 2)
    }
  ];

  participants.forEach((persona, index) => {
    const evidence = [priceEvidence, newsEvidence, filingEvidence, macroEvidence][index % 4] ?? priceEvidence;
    const personaStance: Sentiment =
      persona.presetRole === "riskManager"
        ? stance === "bearish"
          ? "bearish"
          : "neutral"
        : persona.presetRole === "macroEconomist"
          ? "neutral"
          : stance;

    drafts.push({
      speakerPersonaId: persona.id,
      stance: personaStance,
      confidence: 0.68 + index * 0.04,
      text: `${personaAngle(persona)} 관점에서는 ${evidence?.snippet ?? "현재 흐름"}이 핵심입니다. ${rangeText(symbol.price, symbol.market, 0.02)} 구간 반응을 함께 확인해야 합니다.`,
      evidenceIds: [evidence?.id ?? priceEvidence.id]
    });
  });

  drafts.push({
    speakerPersonaId: host.id,
    stance: "neutral",
    confidence: 0.76,
    text: "첫 의견을 종합하면 공통적으로 추격 매수보다 근거 확인이 우선이라는 점이 보입니다. 각자 가장 경계하는 리스크와 기대 요인을 한 번 더 정리해 주세요.",
    evidenceIds: baseIds
  });

  participants.forEach((persona, index) => {
    const evidence = [macroEvidence, filingEvidence, newsEvidence, priceEvidence][index % 4] ?? newsEvidence;
    drafts.push({
      speakerPersonaId: persona.id,
      stance:
        persona.presetRole === "riskManager"
          ? "bearish"
          : persona.presetRole === "macroEconomist"
            ? "neutral"
            : stance,
      confidence: 0.71 + index * 0.03,
      text: `${persona.name} 시각에서는 ${evidence?.snippet ?? "관련 근거"}를 보면 ${symbol.changePct >= 0 ? "상승 여력은 남아 있지만" : "추가 변동성 가능성이 있어"} 단일 가격대 추격보다는 분할 접근이 더 합리적입니다.`,
      evidenceIds: [evidence?.id ?? priceEvidence.id]
    });
  });

  drafts.push({
    speakerPersonaId: host.id,
    stance: "neutral",
    confidence: 0.81,
    text: `정리하면 ${stanceSummary(stance)} 토론 참가자들은 모두 근거 확인형 접근을 권하고 있으며, 특히 이벤트와 거시 변수 변화가 다음 판단의 핵심이라고 봤습니다.`,
    evidenceIds: baseIds
  });

  return drafts;
}

function createTimingCard(bundle: EvidenceBundle): TimingCard {
  const { symbol } = bundle;
  const currency = symbol.market === "KR" ? "KRW" : "USD";

  return {
    summary:
      symbol.changePct >= 0
        ? "추격보다 눌림 확인 후 분할 접근이 유리한 구간입니다."
        : "하락 진정 여부를 확인한 뒤 보수적으로 분할 접근하는 편이 안전합니다.",
    buyZone: {
      label: "매수 관심 구간",
      priceText: rangeText(symbol.price, symbol.market, 0.012),
      reason: "지지 구간에서 거래량이 유지되면 진입 명분이 강화됩니다.",
      tone: "positive"
    },
    chaseWarning: {
      label: "추격 매수 경계 구간",
      priceText: rangeText(symbol.price, symbol.market, 0.035),
      reason: "단기 과열 구간에서는 기대수익 대비 리스크가 빠르게 커집니다.",
      tone: "caution"
    },
    trimZone: {
      label: "분할 매도 고려 구간",
      priceText: formatPrice(symbol.price * 1.05, currency),
      reason: "목표 수익을 일부 반영하고 다음 이벤트를 기다릴 수 있는 구간입니다.",
      tone: "positive"
    },
    riskLine: {
      label: "리스크 관리 구간",
      priceText: formatPrice(symbol.price * 0.96, currency),
      reason: "이 구간이 무너지면 현재 시나리오의 전제가 약해졌다는 신호로 봅니다.",
      tone: "risk"
    },
    validUntil: isoMinutesFromNow(180)
  };
}

function createFinalReport(bundle: EvidenceBundle): FinalReport {
  const { symbol } = bundle;
  const stance = sentimentFromChange(symbol.changePct);

  return {
    overallView:
      stance === "bullish"
        ? `${symbol.name}은 단기 모멘텀이 살아 있으나 추격보다는 눌림 확인 후 접근이 유리합니다.`
        : stance === "bearish"
          ? `${symbol.name}은 변동성이 커서 성급한 진입보다 하방 확인과 분할 대응이 우선입니다.`
          : `${symbol.name}은 방향성이 완전히 굳지 않아 구간 대응과 근거 확인이 필요한 종목입니다.`,
    bullCase:
      "실적 개선, 업종 수급 회복, 추가 뉴스나 공시가 이어지면 단기 재평가 가능성이 있습니다.",
    bearCase:
      "거래량 둔화, 거시 변수 악화, 기대 대비 약한 공시가 겹치면 가격 조정이 길어질 수 있습니다.",
    risks: [
      "실적 또는 가이던스가 기대에 미치지 못할 수 있습니다.",
      "거시 환경 변화에 따라 멀티플이 빠르게 축소될 수 있습니다.",
      "단기 변동성이 커서 추격 진입 시 손익비가 빠르게 악화될 수 있습니다."
    ],
    watchPoints: [
      "직전 고점 돌파 여부와 거래량 동반 여부",
      "마감 기준 수급 유지 여부",
      "추가 뉴스 또는 공시가 기존 기대를 강화하는지 여부"
    ],
    disclaimer:
      "이 분석은 투자 참고용 정보이며 특정 종목의 매수나 매도를 권유하지 않습니다."
  };
}

interface LLMClient {
  generate(
    bundle: EvidenceBundle,
    personas: SelectedPersona[],
    userQuestion?: string
  ): Promise<GeneratedAnalysis>;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

class MockLLMClient implements LLMClient {
  async generate(bundle: EvidenceBundle, personas: SelectedPersona[]): Promise<GeneratedAnalysis> {
    return {
      messages: createMockMessages(bundle, personas),
      timingCard: createTimingCard(bundle),
      finalReport: createFinalReport(bundle)
    };
  }
}

const outputSchema = {
  name: "stock_debate_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      messages: {
        type: "array",
        minItems: 5,
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            speakerPersonaId: { type: "string" },
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
          required: ["speakerPersonaId", "stance", "confidence", "text", "evidenceIds"]
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

function buildPrompt(
  bundle: EvidenceBundle,
  personas: SelectedPersona[],
  userQuestion?: string
) {
  const evidenceText = bundle.items
    .map(
      (item) =>
        `- ${item.id} | ${item.source} | ${item.kind} | ${item.title} | ${item.snippet}`
    )
    .join("\n");

  const personaText = personas
    .map(
      (persona) =>
        `- ${persona.id} | ${persona.name} | ${persona.shortDescription} | ${persona.systemPrompt}`
    )
    .join("\n");

  return [
    "다음 주식 데이터를 바탕으로 다인 토론형 분석 결과를 JSON 스키마에 맞춰 생성하세요.",
    "출력은 반드시 한국어 JSON이어야 합니다.",
    "messages는 선택된 persona만 화자로 사용해야 합니다.",
    "host는 도입, 중간 정리, 결론 정리 역할을 맡아야 합니다.",
    "다른 패널은 각자 최소 두 번은 발언하도록 구성하세요.",
    "직접적인 매수/매도 권유 표현은 피하고 참고용 분석으로 작성하세요.",
    `종목: ${bundle.symbol.name} (${bundle.symbol.symbol})`,
    `시장: ${bundle.symbol.market}`,
    `현재가: ${bundle.symbol.price}`,
    `등락률: ${bundle.symbol.changePct}%`,
    `섹터: ${bundle.symbol.sector}`,
    userQuestion ? `사용자 질문: ${userQuestion}` : "사용자 질문: 없음",
    "선택된 페르소나",
    personaText,
    "근거 데이터",
    evidenceText
  ].join("\n");
}

function normalizeGeneratedAnalysis(
  payload: GeneratedAnalysis,
  bundle: EvidenceBundle,
  personas: SelectedPersona[]
) {
  const personaMap = new Map(personas.map((persona) => [persona.id, persona]));
  const fallbackIds = personas.map((persona) => persona.id);
  const evidenceIds = new Set(bundle.items.map((item) => item.id));

  return {
    messages: payload.messages.map((message, index): DebateMessage => {
      const fallbackId = fallbackIds[index % fallbackIds.length];
      const speakerPersonaId = personaMap.has(message.speakerPersonaId)
        ? message.speakerPersonaId
        : fallbackId;
      const speaker = personaMap.get(speakerPersonaId)?.name ?? "토론자";
      const normalizedEvidenceIds = message.evidenceIds
        .filter((item) => evidenceIds.has(item))
        .slice(0, 3);

      return {
        id: `${bundle.symbol.market.toLowerCase()}-${bundle.symbol.symbol.toLowerCase()}-${index + 1}`,
        speakerPersonaId,
        speaker,
        turn: index + 1,
        emittedAt: new Date(Date.now() + index * 1_000).toISOString(),
        stance: message.stance,
        confidence: Math.max(0.51, Math.min(0.96, message.confidence)),
        text: message.text,
        evidenceIds:
          normalizedEvidenceIds.length > 0
            ? normalizedEvidenceIds
            : bundle.items.slice(0, 1).map((item) => item.id)
      };
    }),
    timingCard: payload.timingCard,
    finalReport: payload.finalReport
  };
}

class OpenAILLMClient implements LLMClient {
  async generate(
    bundle: EvidenceBundle,
    personas: SelectedPersona[],
    userQuestion?: string
  ): Promise<GeneratedAnalysis> {
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) {
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
          json_schema: outputSchema
        },
        messages: [
          {
            role: "system",
            content:
              "너는 공개 주식 토론 서비스의 AI 엔진이다. 응답은 반드시 JSON 스키마에 맞는 한국어 JSON만 반환한다."
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
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as OpenAIChatCompletionResponse;
    const rawText = toJsonText(payload.choices?.[0]?.message?.content);
    if (!rawText) {
      throw new Error("OpenAI returned empty content");
    }

    return JSON.parse(rawText) as GeneratedAnalysis;
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
  personas: SelectedPersona[],
  userQuestion?: string
) {
  const client = createClient();
  try {
    const payload = await client.generate(bundle, personas, userQuestion);
    return normalizeGeneratedAnalysis(payload, bundle, personas);
  } catch (error) {
    console.warn("[llm] falling back to mock output", error);
    return normalizeGeneratedAnalysis(
      await new MockLLMClient().generate(bundle, personas),
      bundle,
      personas
    );
  }
}
