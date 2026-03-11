import type {
  DebateMessage,
  EvidenceBundle,
  FinalReport,
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

export interface GeneratedAnalysis {
  messages: DebateMessage[];
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
      return "우상향 가능성을 더 높게 보고 있습니다.";
    case "neutral":
      return "방향성보다 확인 구간으로 보고 있습니다.";
    case "bearish":
      return "추가 조정 가능성을 더 경계하고 있습니다.";
  }
}

function createMockMessages(bundle: EvidenceBundle): DebateMessage[] {
  const { symbol, items } = bundle;
  const [priceEvidence, newsEvidence, filingEvidence] = items;
  const stance = sentimentFromChange(symbol.changePct);
  const secondStance: Sentiment = stance === "bullish" ? "neutral" : "bullish";
  const riskStance: Sentiment = stance === "bearish" ? "bearish" : "neutral";

  const drafts = [
    {
      role: "host" as const,
      speaker: roleLabel("host"),
      stance: "neutral" as const,
      confidence: 0.74,
      text: `${symbol.name} 현재 흐름은 ${symbol.changePct >= 0 ? "반등 시도" : "조정 압력"} 구간입니다. 먼저 가격과 수급, 뉴스, 거시 변수 중 무엇이 우선인지부터 정리하겠습니다.`,
      evidenceIds: [priceEvidence.id]
    },
    {
      role: "krAnalyst" as const,
      speaker: roleLabel("krAnalyst"),
      stance,
      confidence: 0.78,
      text: `${priceEvidence.snippet} 국내 투자자 관점에서는 ${rangeText(symbol.price, symbol.market, 0.015)} 구간을 1차 판단선으로 보는 게 맞습니다.`,
      evidenceIds: [priceEvidence.id]
    },
    {
      role: "globalAnalyst" as const,
      speaker: roleLabel("globalAnalyst"),
      stance: secondStance,
      confidence: 0.72,
      text: `${newsEvidence.snippet} 해외 비교 종목과 밸류에이션을 같이 보면 지금은 과열 추격보다 확인 매수가 더 적절해 보입니다.`,
      evidenceIds: [newsEvidence.id]
    },
    {
      role: "macroEconomist" as const,
      speaker: roleLabel("macroEconomist"),
      stance: riskStance,
      confidence: 0.7,
      text: `${filingEvidence.snippet} 금리와 환율, 실적 기대치가 같이 흔들리면 단기 타이밍은 좋아 보여도 변동폭이 예상보다 커질 수 있습니다.`,
      evidenceIds: [filingEvidence.id]
    },
    {
      role: "host" as const,
      speaker: roleLabel("host"),
      stance: "neutral" as const,
      confidence: 0.76,
      text: `쟁점은 두 가지입니다. 지금 가격이 눌림목인지, 아니면 재료 대비 선반영인지입니다. 각자 진입 타이밍 관점에서 다시 정리해 주세요.`,
      evidenceIds: [priceEvidence.id, newsEvidence.id]
    },
    {
      role: "krAnalyst" as const,
      speaker: roleLabel("krAnalyst"),
      stance,
      confidence: 0.8,
      text: `${symbol.changePct >= 0 ? "눌림이 얕게 나올 때 분할 접근" : "하락 진정 확인 후 접근"}이 적절합니다. 거래량이 유지되면 단기 스윙 관점에서 기회 구간으로 볼 수 있습니다.`,
      evidenceIds: [priceEvidence.id]
    },
    {
      role: "globalAnalyst" as const,
      speaker: roleLabel("globalAnalyst"),
      stance: riskStance,
      confidence: 0.69,
      text: `다만 ${rangeText(symbol.price, symbol.market, 0.03)} 바깥으로 급하게 움직이면 추격보다 관망이 낫습니다. 이벤트 드리븐 종목처럼 움직일 가능성도 있습니다.`,
      evidenceIds: [newsEvidence.id]
    },
    {
      role: "macroEconomist" as const,
      speaker: roleLabel("macroEconomist"),
      stance: "neutral" as const,
      confidence: 0.73,
      text: `결론적으로 단기 기회는 열려 있지만 거시 변수 확인이 필요합니다. 발표 일정이나 공시가 나오는 날에는 평소보다 보수적인 비중 조절이 필요합니다.`,
      evidenceIds: [filingEvidence.id]
    },
    {
      role: "host" as const,
      speaker: roleLabel("host"),
      stance: "neutral" as const,
      confidence: 0.82,
      text: `합의된 결론은 명확합니다. ${stanceSummary(stance)} 대신 추격보다는 구간 대응, 한 번에 진입보다는 분할 접근이 더 적절하다는 의견이 우세합니다.`,
      evidenceIds: [priceEvidence.id, newsEvidence.id, filingEvidence.id]
    }
  ];

  return drafts.map((draft, index) => ({
    id: `${symbol.market.toLowerCase()}-${symbol.symbol.toLowerCase()}-${index + 1}`,
    turn: index + 1,
    emittedAt: new Date(Date.now() + index * 1_000).toISOString(),
    ...draft
  }));
}

function createTimingCard(bundle: EvidenceBundle): TimingCard {
  const { symbol } = bundle;
  const currency = symbol.market === "KR" ? "KRW" : "USD";

  return {
    summary:
      symbol.changePct >= 0
        ? "추격보다 눌림 확인 후 분할 접근이 유리한 구간입니다."
        : "하락 진정 여부를 확인한 뒤 짧게 분할 접근하는 전략이 더 안전합니다.",
    buyZone: {
      label: "매수 관심구간",
      priceText: rangeText(symbol.price, symbol.market, 0.012),
      reason: "지지선 근처에서 거래량이 유지되면 진입 명분이 강화됩니다.",
      tone: "positive"
    },
    chaseWarning: {
      label: "추격매수 경계구간",
      priceText: rangeText(symbol.price, symbol.market, 0.035),
      reason: "단기 과열 구간에서는 수익 대비 손실 리스크가 커집니다.",
      tone: "caution"
    },
    trimZone: {
      label: "분할매도 고려구간",
      priceText: formatPrice(symbol.price * 1.05, currency),
      reason: "단기 목표수익을 일부 확보하고 다음 재진입 여지를 남기는 구간입니다.",
      tone: "positive"
    },
    riskLine: {
      label: "손절/리스크 관리 구간",
      priceText: formatPrice(symbol.price * 0.96, currency),
      reason: "이 구간이 무너지면 현재 시나리오의 전제가 약해졌다고 봅니다.",
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
        ? `${symbol.name}은 단기 모멘텀이 살아 있지만 추격보다 눌림 확인 후 접근이 유리합니다.`
        : stance === "bearish"
          ? `${symbol.name}은 단기 변동성이 커서 서두른 진입보다 확인 후 분할 접근이 적절합니다.`
          : `${symbol.name}은 방향성이 아직 완전히 열리지 않아 구간 대응이 필요한 종목입니다.`,
    bullCase:
      "수급 유지, 업종 심리 개선, 추가 뉴스 또는 공시가 이어지면 단기 스윙 관점의 재평가가 가능합니다.",
    bearCase:
      "거래량 둔화, 재료 소멸, 시장 전반 리스크 오프가 겹치면 가격 조정이 더 길어질 수 있습니다.",
    risks: [
      "실적 또는 가이던스가 기대에 못 미칠 수 있습니다.",
      "환율과 금리 같은 외부 거시 변수에 따라 방향이 흔들릴 수 있습니다.",
      "장중 변동성이 커서 추격 진입 시 손익비가 빠르게 나빠질 수 있습니다."
    ],
    watchPoints: [
      "직전 고점 돌파 여부와 거래량 동반 여부",
      "장 마감 전 수급 유지 여부",
      "새로운 뉴스/공시가 기존 기대를 강화하는지 여부"
    ],
    disclaimer:
      "이 정보는 투자 참고용 분석이며 특정 종목의 매수·매도를 권유하지 않습니다."
  };
}

interface LLMClient {
  generate(bundle: EvidenceBundle, userQuestion?: string): Promise<GeneratedAnalysis>;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

class MockLLMClient implements LLMClient {
  async generate(bundle: EvidenceBundle): Promise<GeneratedAnalysis> {
    return {
      messages: createMockMessages(bundle),
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
        minItems: 8,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            role: {
              type: "string",
              enum: ["host", "krAnalyst", "globalAnalyst", "macroEconomist"]
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

function buildPrompt(bundle: EvidenceBundle, userQuestion?: string) {
  const evidenceText = bundle.items
    .map(
      (item) =>
        `- ${item.id} | ${item.source} | ${item.kind} | ${item.title} | ${item.snippet}`
    )
    .join("\n");

  return [
    "다음 주식 데이터를 보고 공개 서비스용 분석 결과를 JSON 스키마에 맞춰 생성하세요.",
    "출력은 반드시 한국어여야 합니다.",
    "메시지는 8~10개여야 합니다.",
    "각 메시지는 2~3문장 이하여야 합니다.",
    "전문가 역할은 host, krAnalyst, globalAnalyst, macroEconomist 중 하나만 사용하세요.",
    "evidenceIds는 아래 제공된 id만 사용하세요.",
    "직접적인 투자 권유 표현은 피하고 참고용 분석 톤을 유지하세요.",
    `종목: ${bundle.symbol.name} (${bundle.symbol.symbol})`,
    `시장: ${bundle.symbol.market}`,
    `현재가: ${bundle.symbol.price}`,
    `등락률: ${bundle.symbol.changePct}%`,
    `섹터: ${bundle.symbol.sector}`,
    userQuestion ? `사용자 질문: ${userQuestion}` : "사용자 질문: 없음",
    "근거 데이터:",
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

class OpenAILLMClient implements LLMClient {
  async generate(
    bundle: EvidenceBundle,
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
              "너는 공개형 주식 분석 서비스의 AI 편집팀이다. 반드시 JSON 스키마에 맞춰 응답하고, 한국어로만 작성한다."
          },
          {
            role: "user",
            content: buildPrompt(bundle, userQuestion)
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
  userQuestion?: string
) {
  const client = createClient();
  try {
    return await client.generate(bundle, userQuestion);
  } catch (error) {
    console.warn("[llm] falling back to mock output", error);
    return new MockLLMClient().generate(bundle);
  }
}
