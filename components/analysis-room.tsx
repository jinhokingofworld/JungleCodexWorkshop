"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CUSTOM_PERSONA_STORAGE_KEY,
  HOST_PERSONA_ID,
  LAST_SELECTION_STORAGE_KEY,
  MAX_PERSONA_COUNT,
  MIN_PERSONA_COUNT,
  PERSONA_DRAFT_STORAGE_KEY,
  getDefaultSelectedPersonas,
  hostPersona,
  sanitizePersonaSelection,
  validateSelectedPersonas
} from "@/lib/personas";
import { PersonaManager } from "@/components/persona-manager";
import { stanceLabel } from "@/lib/server/utils";
import type {
  AnalysisSession,
  DebateMessage,
  Market,
  PersonaDefinition,
  PersonaOnboardingDraft,
  SelectedPersona
} from "@/lib/types";

interface AnalysisRoomProps {
  market: Market;
  symbol: string;
  symbolName: string;
  initialSession?: AnalysisSession | null;
  allowPersonaEditing?: boolean;
}

interface CreateAnalysisResponse {
  session: AnalysisSession;
}

function safeJsonParse<T>(raw: string | null, fallback: T) {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function AnalysisRoom({
  market,
  symbol,
  symbolName,
  initialSession = null,
  allowPersonaEditing = true
}: AnalysisRoomProps) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isPending, startTransition] = useTransition();
  const [session, setSession] = useState<AnalysisSession | null>(initialSession);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showReport, setShowReport] = useState(Boolean(initialSession));
  const [error, setError] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [customPersonas, setCustomPersonas] = useState<PersonaDefinition[]>([]);
  const [personaDraft, setPersonaDraft] = useState<PersonaOnboardingDraft | null>(null);
  const [selectedPersonas, setSelectedPersonas] = useState<SelectedPersona[]>(
    initialSession?.personas ?? [
      {
        id: hostPersona.id,
        kind: hostPersona.kind,
        name: hostPersona.name,
        shortDescription: hostPersona.shortDescription,
        systemPrompt: hostPersona.systemPrompt,
        visualTone: hostPersona.visualTone,
        presetRole: hostPersona.presetRole
      }
    ]
  );

  const evidenceMap = useMemo(() => {
    if (!session) {
      return new Map();
    }

    return new Map(session.evidence.map((item) => [item.id, item]));
  }, [session]);

  const personaMap = useMemo(() => {
    const source = session?.personas ?? selectedPersonas;
    return new Map(source.map((persona) => [persona.id, persona]));
  }, [selectedPersonas, session]);

  const canStartDiscussion =
    allowPersonaEditing &&
    selectedPersonas.length >= MIN_PERSONA_COUNT &&
    selectedPersonas.length <= MAX_PERSONA_COUNT;

  useEffect(() => {
    if (initialSession) {
      setSession(initialSession);
      setMessages([]);
      setShowReport(true);
      setSelectedPersonas(initialSession.personas);
      startReplay(initialSession.id);
      return () => closeStream();
    }

    if (!allowPersonaEditing) {
      return () => closeStream();
    }

    const storedCustom = safeJsonParse<PersonaDefinition[]>(
      window.localStorage.getItem(CUSTOM_PERSONA_STORAGE_KEY),
      []
    );
    const storedDraft = safeJsonParse<PersonaOnboardingDraft | null>(
      window.localStorage.getItem(PERSONA_DRAFT_STORAGE_KEY),
      null
    );
    const storedSelection = safeJsonParse<SelectedPersona[] | null>(
      window.localStorage.getItem(LAST_SELECTION_STORAGE_KEY),
      null
    );

    setCustomPersonas(storedCustom);
    setPersonaDraft(storedDraft);
    setSelectedPersonas(
      storedSelection && storedSelection.length > 0
        ? sanitizePersonaSelection(storedSelection)
        : [hostPersona].map((persona) => ({
            id: persona.id,
            kind: persona.kind,
            name: persona.name,
            shortDescription: persona.shortDescription,
            systemPrompt: persona.systemPrompt,
            visualTone: persona.visualTone,
            presetRole: persona.presetRole
          }))
    );

    return () => closeStream();
  }, [allowPersonaEditing, initialSession, market, symbol]);

  useEffect(() => {
    if (!allowPersonaEditing) {
      return;
    }

    window.localStorage.setItem(
      CUSTOM_PERSONA_STORAGE_KEY,
      JSON.stringify(customPersonas)
    );
  }, [allowPersonaEditing, customPersonas]);

  useEffect(() => {
    if (!allowPersonaEditing) {
      return;
    }

    if (personaDraft) {
      window.localStorage.setItem(PERSONA_DRAFT_STORAGE_KEY, JSON.stringify(personaDraft));
      return;
    }

    window.localStorage.removeItem(PERSONA_DRAFT_STORAGE_KEY);
  }, [allowPersonaEditing, personaDraft]);

  useEffect(() => {
    if (!allowPersonaEditing) {
      return;
    }

    window.localStorage.setItem(
      LAST_SELECTION_STORAGE_KEY,
      JSON.stringify(selectedPersonas)
    );
  }, [allowPersonaEditing, selectedPersonas]);

  function closeStream() {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }

  async function createFreshAnalysis() {
    closeStream();
    setError(null);
    setMessages([]);
    setShowReport(false);
    setIsStreaming(true);

    try {
      validateSelectedPersonas(selectedPersonas);
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          market,
          symbol,
          personas: selectedPersonas,
          forceFresh: true
        })
      });

      if (!response.ok) {
        const payload = safeJsonParse<{ error?: string }>(await response.text(), {});
        throw new Error(payload.error ?? "분석 세션 생성에 실패했습니다.");
      }

      const payload = (await response.json()) as CreateAnalysisResponse;
      setSession(payload.session);
      setSelectedPersonas(payload.session.personas);
      startReplay(payload.session.id);
    } catch (cause) {
      setIsStreaming(false);
      setError(cause instanceof Error ? cause.message : "알 수 없는 오류가 발생했습니다.");
    }
  }

  function startReplay(sessionId: string) {
    closeStream();
    setMessages([]);
    setIsStreaming(true);

    const eventSource = new EventSource(`/api/analysis/${sessionId}/stream`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("session", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { session: AnalysisSession };
      setSession(payload.session);
      setSelectedPersonas(payload.session.personas);
    });

    eventSource.addEventListener("message", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { message: DebateMessage };
      setMessages((current) => [...current, payload.message]);
    });

    eventSource.addEventListener("done", () => {
      setShowReport(true);
      setIsStreaming(false);
      eventSource.close();
    });

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
    };
  }

  function togglePersona(persona: PersonaDefinition) {
    setSelectedPersonas((current) => {
      if (persona.id === HOST_PERSONA_ID) {
        return current;
      }

      const exists = current.some((item) => item.id === persona.id);
      if (exists) {
        return current.filter((item) => item.id !== persona.id);
      }

      if (current.length >= MAX_PERSONA_COUNT) {
        return current;
      }

      return sanitizePersonaSelection([
        ...current,
        {
          id: persona.id,
          kind: persona.kind,
          name: persona.name,
          shortDescription: persona.shortDescription,
          systemPrompt: persona.systemPrompt,
          visualTone: persona.visualTone,
          presetRole: persona.presetRole
        }
      ]);
    });
  }

  function saveCustomPersona(persona: PersonaDefinition, autoSelect = false) {
    setCustomPersonas((current) => {
      const next = current.filter((item) => item.id !== persona.id);
      return [persona, ...next];
    });

    if (autoSelect) {
      setSelectedPersonas((current) => {
        const nextPersona: SelectedPersona = {
          id: persona.id,
          kind: persona.kind,
          name: persona.name,
          shortDescription: persona.shortDescription,
          systemPrompt: persona.systemPrompt,
          visualTone: persona.visualTone,
          presetRole: persona.presetRole
        };
        const withoutCurrent = current.filter((item) => item.id !== persona.id);
        if (withoutCurrent.length >= MAX_PERSONA_COUNT) {
          withoutCurrent.pop();
        }

        return sanitizePersonaSelection([...withoutCurrent, nextPersona]);
      });
    }
  }

  function deleteCustomPersona(id: string) {
    setCustomPersonas((current) => current.filter((item) => item.id !== id));
    setSelectedPersonas((current) => current.filter((item) => item.id !== id));
  }

  function duplicateCustomPersona(id: string) {
    const target = customPersonas.find((persona) => persona.id === id);
    if (!target) {
      return;
    }

    const duplicate = {
      ...target,
      id: `custom-${Math.random().toString(36).slice(2, 10)}`,
      name: `${target.name} 복사본`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setCustomPersonas((current) => [duplicate, ...current]);
  }

  const liveMessages =
    messages.length > 0
      ? messages
      : !isStreaming && showReport && session
        ? session.messages
        : [];

  return (
    <>
      <div className="analysis-layout">
        <section className="panel panel-main">
          <div className="panel-header">
            <div>
              <p className="eyebrow">AI Debate</p>
              <h2>{symbolName} AI 토론</h2>
            </div>
            <div className="analysis-toolbar">
              <div className="persona-badge-row">
                {(session?.personas ?? selectedPersonas).map((persona) => (
                  <span
                    className="persona-chip static"
                    key={persona.id}
                    style={{
                      background: persona.visualTone.background,
                      color: persona.visualTone.accent
                    }}
                  >
                    <span
                      className="persona-chip-dot"
                      style={{ background: persona.visualTone.accent }}
                    />
                    {persona.name}
                  </span>
                ))}
              </div>

              <div className="control-row">
                {allowPersonaEditing ? (
                  <button
                    className="secondary-button"
                    onClick={() => setManagerOpen(true)}
                    type="button"
                  >
                    페르소나 설정
                  </button>
                ) : null}

                {session ? (
                  <button
                    className="secondary-button"
                    onClick={() => setShowReport(true)}
                    type="button"
                  >
                    최종 리포트 보기
                  </button>
                ) : null}

                {session ? (
                  <button
                    className="secondary-button"
                    disabled={!session}
                    onClick={() => session && startReplay(session.id)}
                    type="button"
                  >
                    토론 다시 재생
                  </button>
                ) : null}

                {allowPersonaEditing ? (
                  <button
                    className="primary-button"
                    disabled={isPending || !canStartDiscussion}
                    onClick={() => startTransition(() => void createFreshAnalysis())}
                    type="button"
                  >
                    {session ? "같은 종목 다시 분석" : "토론 시작"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {!session && allowPersonaEditing ? (
            <div className="persona-empty-state">
              <strong>토론 준비 중</strong>
              <p>
                진행자는 고정으로 포함됩니다. 추가 토론자를 1명 이상 골라 총 2~4명
                구성을 만든 뒤 토론을 시작하세요.
              </p>
            </div>
          ) : null}

          {error ? <div className="alert-error">{error}</div> : null}

          <div className="messages">
            {liveMessages.map((message) => {
              const persona = personaMap.get(message.speakerPersonaId);
              return (
                <article className="message-card" key={message.id}>
                  <div className="message-meta">
                    <div>
                      <span
                        className="speaker-badge"
                        style={{
                          background: persona?.visualTone.accent ?? "#334155"
                        }}
                      >
                        {message.speaker}
                      </span>
                      <span className="message-stance">{stanceLabel(message.stance)}</span>
                    </div>
                    <span className="muted">확신도 {(message.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p>{message.text}</p>
                  <div className="message-evidence">
                    {message.evidenceIds.map((evidenceId) => {
                      const evidence = evidenceMap.get(evidenceId);
                      if (!evidence) {
                        return null;
                      }

                      return (
                        <span className="evidence-pill" key={evidence.id}>
                          {evidence.source} · {evidence.title}
                        </span>
                      );
                    })}
                  </div>
                </article>
              );
            })}

            {isStreaming ? (
              <div className="typing-indicator">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                <span>토론자들이 다음 발언을 정리하고 있습니다.</span>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="sidebar">
          {session ? (
            <>
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <p className="eyebrow">AI Timing Card</p>
                    <h3>가격 구간 가이드</h3>
                  </div>
                </div>
                <div className="timing-grid">
                  <TimingItem
                    label={session.timingCard.buyZone.label}
                    price={session.timingCard.buyZone.priceText}
                    reason={session.timingCard.buyZone.reason}
                    tone={session.timingCard.buyZone.tone}
                  />
                  <TimingItem
                    label={session.timingCard.chaseWarning.label}
                    price={session.timingCard.chaseWarning.priceText}
                    reason={session.timingCard.chaseWarning.reason}
                    tone={session.timingCard.chaseWarning.tone}
                  />
                  <TimingItem
                    label={session.timingCard.trimZone.label}
                    price={session.timingCard.trimZone.priceText}
                    reason={session.timingCard.trimZone.reason}
                    tone={session.timingCard.trimZone.tone}
                  />
                  <TimingItem
                    label={session.timingCard.riskLine.label}
                    price={session.timingCard.riskLine.priceText}
                    reason={session.timingCard.riskLine.reason}
                    tone={session.timingCard.riskLine.tone}
                  />
                </div>
                <p className="muted">
                  유효기간{" "}
                  {new Date(session.timingCard.validUntil).toLocaleString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <p className="eyebrow">Evidence</p>
                    <h3>출처 요약</h3>
                  </div>
                </div>
                <div className="evidence-list">
                  {session.evidence.map((item) => (
                    <article className="evidence-card" key={item.id}>
                      <div className="session-card-top">
                        <span className="pill">{item.source}</span>
                        <span className="muted">
                          {new Date(item.timestamp).toLocaleString("ko-KR", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>
                      <strong>{item.title}</strong>
                      <p>{item.snippet}</p>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="panel">
              <div className="panel-header compact">
                <div>
                  <p className="eyebrow">Lineup Guide</p>
                  <h3>추천 조합</h3>
                </div>
              </div>
              <div className="signal-list">
                {getDefaultSelectedPersonas(market)
                  .filter((persona) => persona.id !== HOST_PERSONA_ID)
                  .map((persona) => (
                    <p className="signal-item" key={persona.id}>
                      <strong>{persona.name}</strong> · {persona.shortDescription}
                    </p>
                  ))}
              </div>
            </section>
          )}
        </aside>

        {session && showReport ? (
          <section className="panel report-panel">
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">Final Summary</p>
                <h3>투자 참고 리포트</h3>
              </div>
            </div>
            <div className="report-grid">
              <ReportItem label="전체 결론" value={session.finalReport.overallView} />
              <ReportItem label="상승 시나리오" value={session.finalReport.bullCase} />
              <ReportItem label="하락 시나리오" value={session.finalReport.bearCase} />
              <ReportList label="주요 리스크" values={session.finalReport.risks} />
              <ReportList label="다음 체크포인트" values={session.finalReport.watchPoints} />
            </div>
            <p className="disclaimer">{session.finalReport.disclaimer}</p>
          </section>
        ) : null}
      </div>

      {allowPersonaEditing ? (
        <PersonaManager
          customPersonas={customPersonas}
          draft={personaDraft}
          onClose={() => setManagerOpen(false)}
          onDeletePersona={deleteCustomPersona}
          onDraftChange={setPersonaDraft}
          onDuplicatePersona={duplicateCustomPersona}
          onSavePersona={saveCustomPersona}
          onTogglePersona={togglePersona}
          open={managerOpen}
          selectedPersonas={selectedPersonas}
        />
      ) : null}
    </>
  );
}

function TimingItem({
  label,
  price,
  reason,
  tone
}: {
  label: string;
  price: string;
  reason: string;
  tone: "positive" | "caution" | "risk";
}) {
  return (
    <article className={`timing-item ${tone}`}>
      <span className="timing-label">{label}</span>
      <strong>{price}</strong>
      <p>{reason}</p>
    </article>
  );
}

function ReportItem({ label, value }: { label: string; value: string }) {
  return (
    <article className="report-item">
      <span className="timing-label">{label}</span>
      <p>{value}</p>
    </article>
  );
}

function ReportList({ label, values }: { label: string; values: string[] }) {
  return (
    <article className="report-item">
      <span className="timing-label">{label}</span>
      <ul className="report-list">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </article>
  );
}
