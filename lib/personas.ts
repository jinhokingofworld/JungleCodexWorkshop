import type {
  ExpertRole,
  Market,
  PersonaDefinition,
  PersonaOnboardingDraft,
  SelectedPersona
} from "@/lib/types";

export const HOST_PERSONA_ID = "preset-host";
export const MAX_PERSONA_COUNT = 4;
export const MIN_PERSONA_COUNT = 2;
export const CUSTOM_PERSONA_STORAGE_KEY = "stock-debate.custom-personas";
export const PERSONA_DRAFT_STORAGE_KEY = "stock-debate.persona-draft";
export const LAST_SELECTION_STORAGE_KEY = "stock-debate.last-selection";

const roleCopy: Record<
  ExpertRole,
  { name: string; shortDescription: string; accent: string; background: string; prompt: string }
> = {
  host: {
    name: "진행자",
    shortDescription: "토론을 정리하고 쟁점을 묶는 사회자",
    accent: "#0f172a",
    background: "rgba(15, 23, 42, 0.08)",
    prompt:
      "당신은 종목 토론의 진행자다. 참가자들의 핵심 주장과 충돌 지점을 짧고 명확하게 정리하고, 투자 권유 표현 없이 균형 있게 마무리한다."
  },
  krAnalyst: {
    name: "한국 투자전문가",
    shortDescription: "국내 수급, 공시, 업종 흐름에 밝은 애널리스트",
    accent: "#2563eb",
    background: "rgba(37, 99, 235, 0.14)",
    prompt:
      "당신은 한국 주식시장 전문가다. 국내 수급, 공시, 정책, 업종 분위기를 우선 점검하고 가격 변동을 한국 투자자 시각으로 해석한다."
  },
  globalAnalyst: {
    name: "글로벌 투자전문가",
    shortDescription: "해외 경쟁사와 밸류에이션을 비교하는 애널리스트",
    accent: "#0f766e",
    background: "rgba(15, 118, 110, 0.14)",
    prompt:
      "당신은 글로벌 투자 전문가다. 동종 업계 비교, 해외 수요, 밸류에이션, 글로벌 자금 흐름을 근거로 의견을 낸다."
  },
  macroEconomist: {
    name: "거시경제학자",
    shortDescription: "금리, 환율, 경기 흐름이 종목에 미치는 영향을 따지는 분석가",
    accent: "#b45309",
    background: "rgba(180, 83, 9, 0.14)",
    prompt:
      "당신은 거시경제 분석가다. 금리, 환율, 유동성, 경기 지표가 현재 종목의 리스크와 기회에 어떻게 연결되는지 설명한다."
  },
  technicalAnalyst: {
    name: "기술적 분석가",
    shortDescription: "차트와 수급 타이밍을 중시하는 트레이딩 관점의 전문가",
    accent: "#7c3aed",
    background: "rgba(124, 58, 237, 0.14)",
    prompt:
      "당신은 기술적 분석가다. 차트 추세, 거래량, 지지와 저항, 수급 변화에 집중해 타이밍 관점에서 의견을 낸다."
  },
  valueAnalyst: {
    name: "가치투자 애널리스트",
    shortDescription: "실적과 밸류에이션을 중심으로 해자를 보는 분석가",
    accent: "#0f766e",
    background: "rgba(14, 116, 144, 0.14)",
    prompt:
      "당신은 가치투자 애널리스트다. 실적, 현금흐름, 밸류에이션, 경쟁 우위를 중심으로 장기 관점의 판단을 제시한다."
  },
  riskManager: {
    name: "리스크 매니저",
    shortDescription: "하방 위험과 포지션 관리 관점에서 반론을 제기하는 전문가",
    accent: "#be123c",
    background: "rgba(190, 18, 60, 0.14)",
    prompt:
      "당신은 리스크 매니저다. 낙관보다 하방 위험, 시나리오 실패 조건, 포지션 크기와 손실 통제를 우선해서 본다."
  },
  sectorSpecialist: {
    name: "산업/섹터 전문가",
    shortDescription: "산업 구조와 기술 변화의 방향성을 읽는 전문가",
    accent: "#1d4ed8",
    background: "rgba(29, 78, 216, 0.14)",
    prompt:
      "당신은 산업과 섹터를 깊게 보는 전문가다. 공급망, 제품 경쟁력, 기술 전환, 산업 사이클을 중심으로 의견을 제시한다."
  }
};

export const presetPersonas: PersonaDefinition[] = (
  Object.keys(roleCopy) as ExpertRole[]
).map((role) => ({
  id: `preset-${role}`,
  kind: "preset",
  name: roleCopy[role].name,
  shortDescription: roleCopy[role].shortDescription,
  systemPrompt: roleCopy[role].prompt,
  visualTone: {
    accent: roleCopy[role].accent,
    background: roleCopy[role].background
  },
  presetRole: role
}));

export const hostPersona = presetPersonas.find(
  (persona) => persona.id === HOST_PERSONA_ID
) as PersonaDefinition;

const roleFocusPrompts: Record<string, string> = {
  fundamentals: "실적, 밸류에이션, 가이던스를 중심으로 논리를 세운다.",
  technicals: "차트, 수급, 거래량, 단기 타이밍을 우선해서 해석한다.",
  macro: "금리, 환율, 경기 사이클과 거시 변수의 연결을 우선한다.",
  industry: "산업 구조, 경쟁 구도, 기술 변화, 제품 모멘텀을 우선한다.",
  risk: "하방 위험, 실패 조건, 변동성, 포지션 관리 시각을 우선한다.",
  skeptic: "반론을 먼저 제시하고 과도한 낙관을 교정하는 역할을 맡는다."
};

const roleFocusLabels: Record<string, string> = {
  fundamentals: "실적/밸류에이션 중심",
  technicals: "차트/수급 중심",
  macro: "거시/금리 중심",
  industry: "산업/기술 변화 중심",
  risk: "리스크 점검 중심",
  skeptic: "반론 제기 전담"
};

const focusAreaLabels: Record<string, string> = {
  earnings: "매출/영업이익/가이던스",
  valuation: "밸류에이션",
  flows: "거래량/수급",
  chart: "차트 추세",
  peers: "경쟁사 비교",
  macro: "거시지표/금리/환율",
  filings: "공시/정책/규제",
  downside: "리스크/하방 시나리오"
};

const riskLabels: Record<PersonaOnboardingDraft["riskProfile"], string> = {
  aggressive: "공격적",
  balanced: "균형형",
  conservative: "보수적"
};

const horizonLabels: Record<PersonaOnboardingDraft["timeHorizon"], string> = {
  shortTerm: "단기",
  swing: "스윙",
  longTerm: "중장기"
};

const debateStyleLabels: Record<PersonaOnboardingDraft["debateStyle"], string> = {
  assertive: "단정적",
  careful: "신중한",
  challenger: "반박형"
};

const voiceStyleLabels: Record<PersonaOnboardingDraft["voiceStyle"], string> = {
  expert: "전문가형",
  auditor: "냉정한 감사형",
  coach: "친절한 코치형",
  challenger: "날카로운 반론형"
};

const speechRuleLabels: Record<PersonaOnboardingDraft["speechRule"], string> = {
  numbersFirst: "숫자 우선",
  evidenceFirst: "근거 먼저",
  counterFirst: "반론 먼저",
  conclusionFirst: "결론 먼저"
};

export const onboardingRoleOptions = Object.entries(roleFocusLabels).map(([value, label]) => ({
  value,
  label
}));

export const onboardingFocusOptions = Object.entries(focusAreaLabels).map(([value, label]) => ({
  value,
  label
}));

export function getPresetPersonaById(id: string) {
  return presetPersonas.find((persona) => persona.id === id) ?? null;
}

export function toSelectedPersona(persona: PersonaDefinition): SelectedPersona {
  return {
    id: persona.id,
    kind: persona.kind,
    name: persona.name,
    shortDescription: persona.shortDescription,
    systemPrompt: persona.systemPrompt,
    visualTone: persona.visualTone,
    presetRole: persona.presetRole
  };
}

export function getDefaultSelectedPersonas(market: Market): SelectedPersona[] {
  const ids =
    market === "KR"
      ? [HOST_PERSONA_ID, "preset-krAnalyst", "preset-macroEconomist"]
      : [HOST_PERSONA_ID, "preset-globalAnalyst", "preset-technicalAnalyst"];

  return ids
    .map((id) => getPresetPersonaById(id))
    .filter((persona): persona is PersonaDefinition => Boolean(persona))
    .map(toSelectedPersona);
}

export function createEmptyOnboardingDraft(): PersonaOnboardingDraft {
  return {
    name: "",
    shortDescription: "",
    roleFocus: "fundamentals",
    focusAreas: ["earnings", "valuation"],
    riskProfile: "balanced",
    timeHorizon: "swing",
    debateStyle: "careful",
    voiceStyle: "expert",
    speechRule: "evidenceFirst"
  };
}

export function buildPromptFromOnboarding(draft: PersonaOnboardingDraft) {
  const focusAreas = draft.focusAreas
    .map((item) => focusAreaLabels[item] ?? item)
    .join(", ");

  return [
    `당신은 "${draft.name || "커스텀 투자 페르소나"}"라는 이름의 투자 토론 패널이다.`,
    draft.shortDescription
      ? `정체성: ${draft.shortDescription}`
      : "정체성: 특정 투자 프레임을 가진 커스텀 분석가",
    `기본 역할: ${roleFocusLabels[draft.roleFocus] ?? draft.roleFocus}. ${roleFocusPrompts[draft.roleFocus] ?? ""}`,
    `우선적으로 보는 요소: ${focusAreas}.`,
    `투자 성향: ${riskLabels[draft.riskProfile]}.`,
    `시간 축: ${horizonLabels[draft.timeHorizon]}.`,
    `토론 태도: ${debateStyleLabels[draft.debateStyle]}.`,
    `말투: ${voiceStyleLabels[draft.voiceStyle]}.`,
    `화법 규칙: ${speechRuleLabels[draft.speechRule]}.`,
    "다른 패널과 의견이 부딪히면 자신의 근거를 먼저 명확히 밝히고, 필요하면 반론도 제시한다.",
    "직접적인 매수/매도 권유 표현은 피하고, 근거 중심의 짧은 발언으로 토론에 참여한다."
  ].join(" ");
}

export function buildPreviewIntroduction(draft: PersonaOnboardingDraft) {
  const focusAreas = draft.focusAreas
    .slice(0, 2)
    .map((item) => focusAreaLabels[item] ?? item)
    .join(", ");

  return `${draft.name || "이 페르소나"}는 ${roleFocusLabels[draft.roleFocus] ?? draft.roleFocus} 관점에서 ${focusAreas}를 우선 점검하는 ${voiceStyleLabels[draft.voiceStyle]} 토론자입니다.`;
}

export function buildCustomPersonaFromDraft(
  draft: PersonaOnboardingDraft,
  existingId?: string
): PersonaDefinition {
  const now = new Date().toISOString();
  return {
    id: existingId ?? `custom-${Math.random().toString(36).slice(2, 10)}`,
    kind: "custom",
    name: draft.name.trim(),
    shortDescription: draft.shortDescription.trim(),
    systemPrompt: buildPromptFromOnboarding(draft),
    visualTone: {
      accent: "#7c3aed",
      background: "rgba(124, 58, 237, 0.12)"
    },
    createdAt: now,
    updatedAt: now,
    creationMode: "onboarding",
    onboardingSelections: {
      ...draft,
      generatedPrompt: buildPromptFromOnboarding(draft)
    }
  };
}

export function buildDirectPersona(input: {
  id?: string;
  name: string;
  shortDescription: string;
  systemPrompt: string;
}): PersonaDefinition {
  const now = new Date().toISOString();
  return {
    id: input.id ?? `custom-${Math.random().toString(36).slice(2, 10)}`,
    kind: "custom",
    name: input.name.trim(),
    shortDescription: input.shortDescription.trim(),
    systemPrompt: input.systemPrompt.trim(),
    visualTone: {
      accent: "#c2410c",
      background: "rgba(194, 65, 12, 0.12)"
    },
    createdAt: now,
    updatedAt: now,
    creationMode: "direct"
  };
}

export function sanitizePersonaSelection(personas: SelectedPersona[]) {
  const deduped = new Map<string, SelectedPersona>();
  for (const persona of personas) {
    deduped.set(persona.id, persona);
  }

  const ordered = Array.from(deduped.values());
  const host = ordered.find((persona) => persona.id === HOST_PERSONA_ID);
  const others = ordered.filter((persona) => persona.id !== HOST_PERSONA_ID);

  return [host ?? toSelectedPersona(hostPersona), ...others].slice(0, MAX_PERSONA_COUNT);
}

export function validateSelectedPersonas(personas: SelectedPersona[]) {
  if (personas.length < MIN_PERSONA_COUNT || personas.length > MAX_PERSONA_COUNT) {
    throw new Error("Persona selection must include 2 to 4 speakers.");
  }

  if (!personas.some((persona) => persona.id === HOST_PERSONA_ID)) {
    throw new Error("Host persona is required.");
  }

  for (const persona of personas) {
    if (!persona.id || !persona.name || !persona.systemPrompt) {
      throw new Error("Each persona must include id, name, and systemPrompt.");
    }
  }
}
