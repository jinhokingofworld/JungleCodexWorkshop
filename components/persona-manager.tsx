"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildCustomPersonaFromDraft,
  buildDirectPersona,
  buildPreviewIntroduction,
  buildPromptFromOnboarding,
  createEmptyOnboardingDraft,
  hostPersona,
  onboardingFocusOptions,
  onboardingRoleOptions,
  presetPersonas,
  toSelectedPersona
} from "@/lib/personas";
import type {
  PersonaDefinition,
  PersonaOnboardingDraft,
  SelectedPersona
} from "@/lib/types";

interface PersonaManagerProps {
  open: boolean;
  selectedPersonas: SelectedPersona[];
  customPersonas: PersonaDefinition[];
  draft: PersonaOnboardingDraft | null;
  onClose: () => void;
  onTogglePersona: (persona: PersonaDefinition) => void;
  onSavePersona: (persona: PersonaDefinition, autoSelect?: boolean) => void;
  onDeletePersona: (id: string) => void;
  onDuplicatePersona: (id: string) => void;
  onDraftChange: (draft: PersonaOnboardingDraft | null) => void;
}

type ManagerTab = "preset" | "custom";
type ComposerMode = "onboarding" | "direct" | null;

const horizonOptions = [
  { value: "shortTerm", label: "단기" },
  { value: "swing", label: "스윙" },
  { value: "longTerm", label: "중장기" }
] as const;

const riskOptions = [
  { value: "aggressive", label: "공격적" },
  { value: "balanced", label: "균형형" },
  { value: "conservative", label: "보수적" }
] as const;

const debateStyleOptions = [
  { value: "assertive", label: "단정적" },
  { value: "careful", label: "신중한" },
  { value: "challenger", label: "반박형" }
] as const;

const voiceStyleOptions = [
  { value: "expert", label: "전문가형" },
  { value: "auditor", label: "냉정한 감사형" },
  { value: "coach", label: "친절한 코치형" },
  { value: "challenger", label: "날카로운 반론형" }
] as const;

const speechRuleOptions = [
  { value: "numbersFirst", label: "숫자 우선" },
  { value: "evidenceFirst", label: "근거 먼저" },
  { value: "counterFirst", label: "반론 먼저" },
  { value: "conclusionFirst", label: "결론 먼저" }
] as const;

const onboardingStepTitles = [
  "기본 정보",
  "역할 성향",
  "분석 관점",
  "투자 태도",
  "말투",
  "미리보기"
];

export function PersonaManager({
  open,
  selectedPersonas,
  customPersonas,
  draft,
  onClose,
  onTogglePersona,
  onSavePersona,
  onDeletePersona,
  onDuplicatePersona,
  onDraftChange
}: PersonaManagerProps) {
  const [tab, setTab] = useState<ManagerTab>("preset");
  const [composerMode, setComposerMode] = useState<ComposerMode>(null);
  const [step, setStep] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [workingDraft, setWorkingDraft] = useState<PersonaOnboardingDraft>(
    draft ?? createEmptyOnboardingDraft()
  );
  const [directForm, setDirectForm] = useState({
    id: "",
    name: "",
    shortDescription: "",
    systemPrompt: ""
  });

  const selectedIds = useMemo(
    () => new Set(selectedPersonas.map((persona) => persona.id)),
    [selectedPersonas]
  );

  useEffect(() => {
    if (draft && composerMode !== "onboarding") {
      setWorkingDraft(draft);
    }
  }, [draft, composerMode]);

  useEffect(() => {
    if (composerMode === "onboarding") {
      onDraftChange(workingDraft);
    }
  }, [composerMode, onDraftChange, workingDraft]);

  if (!open) {
    return null;
  }

  function resetComposer() {
    setComposerMode(null);
    setEditingId(null);
    setStep(0);
  }

  function beginOnboarding(existing?: PersonaDefinition) {
    setTab("custom");
    setComposerMode("onboarding");
    setStep(0);
    setEditingId(existing?.id ?? null);
    setWorkingDraft(existing?.onboardingSelections ?? draft ?? createEmptyOnboardingDraft());
  }

  function beginDirect(existing?: PersonaDefinition) {
    setTab("custom");
    setComposerMode("direct");
    setEditingId(existing?.id ?? null);
    setDirectForm({
      id: existing?.id ?? "",
      name: existing?.name ?? "",
      shortDescription: existing?.shortDescription ?? "",
      systemPrompt: existing?.systemPrompt ?? ""
    });
  }

  function handleSaveOnboarding() {
    const persona = buildCustomPersonaFromDraft(workingDraft, editingId ?? undefined);
    onSavePersona(persona, true);
    onDraftChange(null);
    resetComposer();
  }

  function handleSaveDirect() {
    const persona = buildDirectPersona(directForm);
    onSavePersona(persona, true);
    resetComposer();
  }

  function stepIsValid(currentStep: number) {
    if (currentStep === 0) {
      return (
        workingDraft.name.trim().length >= 2 &&
        workingDraft.shortDescription.trim().length >= 6
      );
    }

    if (currentStep === 2) {
      return workingDraft.focusAreas.length >= 2 && workingDraft.focusAreas.length <= 4;
    }

    return true;
  }

  const generatedPrompt = buildPromptFromOnboarding(workingDraft);

  return (
    <div className="persona-modal-backdrop" role="presentation">
      <div
        aria-label="페르소나 관리자"
        aria-modal="true"
        className="persona-modal"
        role="dialog"
      >
        <div className="panel-header compact">
          <div>
            <p className="eyebrow">Persona Setup</p>
            <h3>토론자 구성하기</h3>
          </div>
          <button className="ghost-button persona-close" onClick={onClose} type="button">
            닫기
          </button>
        </div>

        <section className="persona-selected-strip">
          <div>
            <span className="timing-label">현재 선택</span>
            <strong>{selectedPersonas.length} / 4명</strong>
          </div>
          <div className="persona-badge-row">
            {selectedPersonas.map((persona) => (
              <button
                className="persona-chip active"
                key={persona.id}
                onClick={() =>
                  persona.id === hostPersona.id
                    ? undefined
                    : onTogglePersona({ ...persona, creationMode: "direct" })
                }
                type="button"
              >
                <span
                  className="persona-chip-dot"
                  style={{ background: persona.visualTone.accent }}
                />
                {persona.name}
                {persona.id === hostPersona.id ? <span className="mini-pill">고정</span> : " ×"}
              </button>
            ))}
          </div>
        </section>

        {composerMode ? (
          <section className="persona-composer">
            {composerMode === "onboarding" ? (
              <>
                <div className="persona-stepper">
                  {onboardingStepTitles.map((title, index) => (
                    <div
                      className={`persona-step ${index === step ? "active" : ""}`}
                      key={title}
                    >
                      <span>{index + 1}</span>
                      <strong>{title}</strong>
                    </div>
                  ))}
                </div>

                {step === 0 ? (
                  <div className="persona-form-grid">
                    <label className="persona-field">
                      <span>페르소나 이름</span>
                      <input
                        onChange={(event) =>
                          setWorkingDraft((current) => ({
                            ...current,
                            name: event.target.value
                          }))
                        }
                        placeholder="공격적 성장주 트레이더"
                        value={workingDraft.name}
                      />
                    </label>
                    <label className="persona-field">
                      <span>한줄 소개</span>
                      <input
                        onChange={(event) =>
                          setWorkingDraft((current) => ({
                            ...current,
                            shortDescription: event.target.value
                          }))
                        }
                        placeholder="실적과 수급이 같이 붙는 타이밍만 노리는 단기형 토론자"
                        value={workingDraft.shortDescription}
                      />
                    </label>
                  </div>
                ) : null}

                {step === 1 ? (
                  <OptionGroup
                    options={onboardingRoleOptions}
                    selected={workingDraft.roleFocus}
                    title="기본 역할을 고르세요"
                    onSelect={(value) =>
                      setWorkingDraft((current) => ({ ...current, roleFocus: value }))
                    }
                  />
                ) : null}

                {step === 2 ? (
                  <MultiOptionGroup
                    max={4}
                    min={2}
                    options={onboardingFocusOptions}
                    selected={workingDraft.focusAreas}
                    title="우선적으로 볼 요소를 2~4개 고르세요"
                    onToggle={(value) =>
                      setWorkingDraft((current) => {
                        const exists = current.focusAreas.includes(value);
                        if (exists) {
                          return {
                            ...current,
                            focusAreas: current.focusAreas.filter((item) => item !== value)
                          };
                        }

                        if (current.focusAreas.length >= 4) {
                          return current;
                        }

                        return {
                          ...current,
                          focusAreas: [...current.focusAreas, value]
                        };
                      })
                    }
                  />
                ) : null}

                {step === 3 ? (
                  <div className="persona-form-grid">
                    <OptionGroup
                      options={riskOptions}
                      selected={workingDraft.riskProfile}
                      title="투자 성향"
                      onSelect={(value) =>
                        setWorkingDraft((current) => ({
                          ...current,
                          riskProfile: value as PersonaOnboardingDraft["riskProfile"]
                        }))
                      }
                    />
                    <OptionGroup
                      options={horizonOptions}
                      selected={workingDraft.timeHorizon}
                      title="시간 축"
                      onSelect={(value) =>
                        setWorkingDraft((current) => ({
                          ...current,
                          timeHorizon: value as PersonaOnboardingDraft["timeHorizon"]
                        }))
                      }
                    />
                    <OptionGroup
                      options={debateStyleOptions}
                      selected={workingDraft.debateStyle}
                      title="발언 태도"
                      onSelect={(value) =>
                        setWorkingDraft((current) => ({
                          ...current,
                          debateStyle: value as PersonaOnboardingDraft["debateStyle"]
                        }))
                      }
                    />
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="persona-form-grid">
                    <OptionGroup
                      options={voiceStyleOptions}
                      selected={workingDraft.voiceStyle}
                      title="말투"
                      onSelect={(value) =>
                        setWorkingDraft((current) => ({
                          ...current,
                          voiceStyle: value as PersonaOnboardingDraft["voiceStyle"]
                        }))
                      }
                    />
                    <OptionGroup
                      options={speechRuleOptions}
                      selected={workingDraft.speechRule}
                      title="화법 규칙"
                      onSelect={(value) =>
                        setWorkingDraft((current) => ({
                          ...current,
                          speechRule: value as PersonaOnboardingDraft["speechRule"]
                        }))
                      }
                    />
                  </div>
                ) : null}

                {step === 5 ? (
                  <div className="persona-preview">
                    <article className="report-item">
                      <span className="timing-label">샘플 소개</span>
                      <p>{buildPreviewIntroduction(workingDraft)}</p>
                    </article>
                    <article className="report-item">
                      <span className="timing-label">자동 생성 프롬프트</span>
                      <p>{generatedPrompt}</p>
                    </article>
                    <div className="control-row">
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setDirectForm({
                            id: editingId ?? "",
                            name: workingDraft.name,
                            shortDescription: workingDraft.shortDescription,
                            systemPrompt: generatedPrompt
                          });
                          setComposerMode("direct");
                        }}
                        type="button"
                      >
                        직접 프롬프트로 전환
                      </button>
                      <button className="primary-button" onClick={handleSaveOnboarding} type="button">
                        저장하고 선택
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="control-row">
                  <button
                    className="secondary-button"
                    onClick={() => {
                      if (step === 0) {
                        resetComposer();
                        return;
                      }

                      setStep((current) => current - 1);
                    }}
                    type="button"
                  >
                    {step === 0 ? "취소" : "이전"}
                  </button>
                  {step < onboardingStepTitles.length - 1 ? (
                    <button
                      className="primary-button"
                      disabled={!stepIsValid(step)}
                      onClick={() => setStep((current) => current + 1)}
                      type="button"
                    >
                      다음
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="persona-form-grid">
                  <label className="persona-field">
                    <span>페르소나 이름</span>
                    <input
                      onChange={(event) =>
                        setDirectForm((current) => ({ ...current, name: event.target.value }))
                      }
                      value={directForm.name}
                    />
                  </label>
                  <label className="persona-field">
                    <span>한줄 소개</span>
                    <input
                      onChange={(event) =>
                        setDirectForm((current) => ({
                          ...current,
                          shortDescription: event.target.value
                        }))
                      }
                      value={directForm.shortDescription}
                    />
                  </label>
                  <label className="persona-field full">
                    <span>시스템 프롬프트</span>
                    <textarea
                      onChange={(event) =>
                        setDirectForm((current) => ({
                          ...current,
                          systemPrompt: event.target.value
                        }))
                      }
                      rows={8}
                      value={directForm.systemPrompt}
                    />
                  </label>
                </div>
                <div className="control-row">
                  <button className="secondary-button" onClick={resetComposer} type="button">
                    취소
                  </button>
                  <button
                    className="primary-button"
                    disabled={
                      directForm.name.trim().length < 2 ||
                      directForm.systemPrompt.trim().length < 20
                    }
                    onClick={handleSaveDirect}
                    type="button"
                  >
                    저장하고 선택
                  </button>
                </div>
              </>
            )}
          </section>
        ) : (
          <>
            <div className="persona-tabs">
              <button
                className={tab === "preset" ? "active" : ""}
                onClick={() => setTab("preset")}
                type="button"
              >
                프리셋
              </button>
              <button
                className={tab === "custom" ? "active" : ""}
                onClick={() => setTab("custom")}
                type="button"
              >
                커스텀
              </button>
            </div>

            {tab === "preset" ? (
              <div className="persona-card-grid">
                {presetPersonas.map((persona) => {
                  const selected = selectedIds.has(persona.id);
                  const locked = persona.id === hostPersona.id;

                  return (
                    <button
                      className={`persona-card ${selected ? "selected" : ""}`}
                      key={persona.id}
                      onClick={() => (locked ? undefined : onTogglePersona(persona))}
                      type="button"
                    >
                      <div className="session-card-top">
                        <strong>{persona.name}</strong>
                        <span className="mini-pill" style={{ color: persona.visualTone.accent }}>
                          {locked ? "고정" : selected ? "선택됨" : "추가"}
                        </span>
                      </div>
                      <p>{persona.shortDescription}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="control-row">
                  <button className="secondary-button" onClick={() => beginOnboarding()} type="button">
                    온보딩으로 만들기
                  </button>
                  <button className="secondary-button" onClick={() => beginDirect()} type="button">
                    직접 작성
                  </button>
                  {draft ? (
                    <button className="ghost-button" onClick={() => beginOnboarding()} type="button">
                      초안 이어쓰기
                    </button>
                  ) : null}
                </div>

                <div className="persona-card-grid">
                  {customPersonas.length === 0 ? (
                    <article className="report-item">
                      <span className="timing-label">저장된 커스텀 없음</span>
                      <p>온보딩 또는 직접 작성으로 나만의 토론자를 추가하세요.</p>
                    </article>
                  ) : null}

                  {customPersonas.map((persona) => {
                    const selected = selectedIds.has(persona.id);

                    return (
                      <article className={`persona-card ${selected ? "selected" : ""}`} key={persona.id}>
                        <div className="session-card-top">
                          <strong>{persona.name}</strong>
                          <span className="mini-pill">{selected ? "선택됨" : "저장됨"}</span>
                        </div>
                        <p>{persona.shortDescription}</p>
                        <div className="persona-card-actions">
                          <button
                            className="secondary-button"
                            onClick={() => onTogglePersona(persona)}
                            type="button"
                          >
                            {selected ? "선택 해제" : "토론에 추가"}
                          </button>
                          <button
                            className="ghost-button"
                            onClick={() =>
                              persona.creationMode === "onboarding" && persona.onboardingSelections
                                ? beginOnboarding(persona)
                                : beginDirect(persona)
                            }
                            type="button"
                          >
                            편집
                          </button>
                          <button
                            className="ghost-button"
                            onClick={() => onDuplicatePersona(persona.id)}
                            type="button"
                          >
                            복제
                          </button>
                          <button
                            className="ghost-button"
                            onClick={() => onDeletePersona(persona.id)}
                            type="button"
                          >
                            삭제
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OptionGroup({
  title,
  options,
  selected,
  onSelect
}: {
  title: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <section className="persona-option-group">
      <span className="timing-label">{title}</span>
      <div className="persona-choice-grid">
        {options.map((option) => (
          <button
            className={`persona-choice ${selected === option.value ? "selected" : ""}`}
            key={option.value}
            onClick={() => onSelect(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function MultiOptionGroup({
  title,
  options,
  selected,
  min,
  max,
  onToggle
}: {
  title: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  min: number;
  max: number;
  onToggle: (value: string) => void;
}) {
  return (
    <section className="persona-option-group">
      <span className="timing-label">
        {title} ({selected.length}/{max})
      </span>
      <div className="persona-choice-grid">
        {options.map((option) => (
          <button
            className={`persona-choice ${selected.includes(option.value) ? "selected" : ""}`}
            key={option.value}
            onClick={() => onToggle(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="muted">최소 {min}개, 최대 {max}개까지 선택할 수 있습니다.</p>
    </section>
  );
}
