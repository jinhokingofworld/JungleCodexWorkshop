import type { ExpertRole, PersonaName, PersonaOption, PersonaRecord } from "@/lib/types";

export const DEFAULT_PERSONA_NAMES: PersonaName[] = [
  "krAnalyst",
  "globalAnalyst",
  "macroEconomist"
];

export const PERSONA_PRESET_SEED: PersonaRecord[] = [
  { id: "000000000000000000000101", name: "krAnalyst", count: 0 },
  { id: "000000000000000000000102", name: "globalAnalyst", count: 0 },
  { id: "000000000000000000000103", name: "macroEconomist", count: 0 },
  { id: "000000000000000000000104", name: "valueInvestor", count: 0 },
  { id: "000000000000000000000105", name: "growthStrategist", count: 0 },
  { id: "000000000000000000000106", name: "technicalAnalyst", count: 0 },
  { id: "000000000000000000000107", name: "quantAnalyst", count: 0 },
  { id: "000000000000000000000108", name: "riskManager", count: 0 }
];

interface RolePresentation {
  label: string;
  description: string;
  llmDescription: string;
}

const hostPresentation: RolePresentation = {
  label: "진행자",
  description: "핵심 쟁점을 정리하고 토론의 결론을 구조화합니다.",
  llmDescription:
    "Moderate the debate, keep the discussion grounded in the evidence, and close with a balanced summary."
};

const personaPresentations: Record<PersonaName, RolePresentation> = {
  krAnalyst: {
    label: "한국 투자전문가",
    description: "국내 수급, 공시, 업종 흐름을 바탕으로 해석합니다.",
    llmDescription:
      "Focus on Korean market positioning, local disclosures, and domestic investor behavior."
  },
  globalAnalyst: {
    label: "글로벌 투자전문가",
    description: "해외 피어 비교와 글로벌 자금 흐름을 점검합니다.",
    llmDescription:
      "Compare with global peers, overseas capital flows, and cross-border valuation context."
  },
  macroEconomist: {
    label: "거시경제학자",
    description: "금리, 환율, 유동성 같은 거시 변수의 영향을 짚습니다.",
    llmDescription:
      "Evaluate macro forces such as rates, FX, liquidity, and policy signals."
  },
  valueInvestor: {
    label: "가치투자자",
    description: "밸류에이션과 하방 여력을 중심으로 접근합니다.",
    llmDescription:
      "Assess margin of safety, valuation support, and downside protection."
  },
  growthStrategist: {
    label: "성장주 전략가",
    description: "실적 성장률과 장기 확장성을 우선적으로 봅니다.",
    llmDescription:
      "Prioritize growth durability, earnings acceleration, and long-term expansion potential."
  },
  technicalAnalyst: {
    label: "기술적 분석가",
    description: "차트 흐름과 거래량 패턴으로 타이밍을 판단합니다.",
    llmDescription:
      "Read price action, momentum, support-resistance levels, and volume confirmation."
  },
  quantAnalyst: {
    label: "퀀트 애널리스트",
    description: "수치 신호와 확률 기반 관점으로 판단합니다.",
    llmDescription:
      "Use factor signals, statistical tendencies, and probability-based framing."
  },
  riskManager: {
    label: "리스크 매니저",
    description: "손실 통제와 포지션 규모 관점에서 경계선을 제시합니다.",
    llmDescription:
      "Stress-test downside scenarios, position sizing, and risk control triggers."
  }
};

export function getRolePresentation(role: ExpertRole) {
  if (role === "host") {
    return hostPresentation;
  }

  return personaPresentations[role];
}

export function roleLabelFromCatalog(role: ExpertRole) {
  return getRolePresentation(role).label;
}

export function personaOptionFromRecord(record: PersonaRecord): PersonaOption {
  const presentation = personaPresentations[record.name];

  return {
    ...record,
    label: presentation.label,
    description: presentation.description
  };
}

export function getDefaultPersonaIdsFromRecords(records: PersonaRecord[]) {
  const defaultNames = new Set(DEFAULT_PERSONA_NAMES);
  return records
    .filter((record) => defaultNames.has(record.name))
    .map((record) => record.id);
}

export function getPersonaLlmDescription(name: PersonaName) {
  return personaPresentations[name].llmDescription;
}
