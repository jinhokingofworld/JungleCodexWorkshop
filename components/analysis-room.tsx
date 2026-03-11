"use client";

import { DEFAULT_PERSONA_NAMES } from "@/lib/personas";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
  AnalysisSession,
  DebateMessage,
  Market,
  PersonaOption,
  SelectedPersona
} from "@/lib/types";
import { roleLabel, stanceLabel } from "@/lib/server/utils";

interface AnalysisRoomProps {
  market: Market;
  symbol: string;
  symbolName: string;
  initialSession?: AnalysisSession | null;
}

interface CreateAnalysisResponse {
  session: AnalysisSession;
}

interface PersonaListResponse {
  personas: PersonaOption[];
}

function pickDefaultPersonaIds(personas: PersonaOption[]) {
  const defaultNameSet = new Set(DEFAULT_PERSONA_NAMES);
  const preferred = personas
    .filter((persona) => defaultNameSet.has(persona.name))
    .map((persona) => persona.id);

  if (preferred.length >= 3) {
    return preferred;
  }

  return personas.slice(0, 3).map((persona) => persona.id);
}

function mapSelection(personas: PersonaOption[], ids: string[]): SelectedPersona[] {
  const personaMap = new Map(personas.map((persona) => [persona.id, persona]));

  return ids.flatMap((id) => {
    const persona = personaMap.get(id);
    return persona
      ? [{ id: persona.id, name: persona.name, label: persona.label }]
      : [];
  });
}

export function AnalysisRoom({
  market,
  symbol,
  symbolName,
  initialSession = null
}: AnalysisRoomProps) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [session, setSession] = useState<AnalysisSession | null>(initialSession);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>(
    initialSession?.selectedPersonas.map((persona) => persona.id) ?? []
  );
  const [isPersonaLoading, setIsPersonaLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(Boolean(initialSession));
  const [showReport, setShowReport] = useState(Boolean(initialSession));
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personaError, setPersonaError] = useState<string | null>(null);

  const evidenceMap = useMemo(() => {
    if (!session) {
      return new Map();
    }

    return new Map(session.evidence.map((item) => [item.id, item]));
  }, [session]);

  const selectedPersonas = useMemo(() => {
    if (session) {
      return session.selectedPersonas;
    }

    return mapSelection(personas, selectedPersonaIds);
  }, [personas, selectedPersonaIds, session]);

  const selectionCount = selectedPersonaIds.length;
  const isSelectionValid = selectionCount >= 2 && selectionCount <= 4;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    }

    if (isPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }

    return;
  }, [isPopoverOpen]);

  useEffect(() => {
    const controller = new AbortController();

    closeStream();
    setError(null);
    setPersonaError(null);
    setMessages([]);
    setPersonas([]);
    setIsPopoverOpen(false);
    setSession(initialSession);
    setShowReport(Boolean(initialSession));
    setIsStreaming(Boolean(initialSession));
    setSelectedPersonaIds(initialSession?.selectedPersonas.map((persona) => persona.id) ?? []);
    setIsPersonaLoading(true);

    void loadPersonas(controller.signal, initialSession?.selectedPersonas.map((persona) => persona.id));

    if (initialSession) {
      startReplay(initialSession.id);
    }

    return () => {
      controller.abort();
      closeStream();
    };
  }, [initialSession, market, symbol]);

  function closeStream() {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }

  async function loadPersonas(signal: AbortSignal, sessionPersonaIds?: string[]) {
    try {
      const response = await fetch("/api/personas", { signal });
      const payload = (await response.json()) as PersonaListResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "페르소나 목록을 불러오지 못했습니다.");
      }

      setPersonas(payload.personas);

      if (sessionPersonaIds && sessionPersonaIds.length > 0) {
        setSelectedPersonaIds(mapSelection(payload.personas, sessionPersonaIds).map((persona) => persona.id));
      } else {
        setSelectedPersonaIds(pickDefaultPersonaIds(payload.personas));
      }
    } catch (cause) {
      if (!signal.aborted) {
        setPersonaError(
          cause instanceof Error ? cause.message : "페르소나 목록을 불러오지 못했습니다."
        );
      }
    } finally {
      if (!signal.aborted) {
        setIsPersonaLoading(false);
      }
    }
  }

  async function createFreshAnalysis() {
    if (!isSelectionValid) {
      setError("토론 시작 전 2명 이상 4명 이하의 페르소나를 선택해주세요.");
      return;
    }

    closeStream();
    setError(null);
    setMessages([]);
    setShowReport(false);
    setIsStreaming(true);
    setSession(null);
    setIsPopoverOpen(false);

    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          market,
          symbol,
          personaIds: selectedPersonaIds,
          forceFresh: true
        })
      });

      const payload = (await response.json()) as CreateAnalysisResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "분석 생성에 실패했습니다.");
      }

      setSession(payload.session);
      setSelectedPersonaIds(payload.session.selectedPersonas.map((persona) => persona.id));
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
      setShowReport(true);
      setIsStreaming(false);
      setError("토론 스트림 연결이 끊어졌습니다.");
      eventSource.close();
    };
  }

  function togglePersona(personaId: string) {
    if (session) {
      return;
    }

    setSelectedPersonaIds((current) => {
      if (current.includes(personaId)) {
        return current.filter((id) => id !== personaId);
      }

      if (current.length >= 4) {
        return current;
      }

      return [...current, personaId];
    });
  }

  const liveMessages =
    messages.length > 0
      ? messages
      : !isStreaming && showReport && session
        ? session.messages
        : [];

  return (
    <div className="analysis-layout">
      <section className="panel panel-main">
        <div className="panel-header">
          <div>
            <p className="eyebrow">AI 토론</p>
            <h2>{symbolName} 전문가 토론</h2>
          </div>
          <div className="analysis-toolbar">
            <div className="persona-badge-row">
              <span className="speaker-badge host locked">{roleLabel("host")}</span>
              {selectedPersonas.map((persona) => (
                <span className={`speaker-badge ${persona.name}`} key={persona.id}>
                  {persona.label}
                </span>
              ))}
            </div>

            {!session && !isStreaming ? (
              <div className="analysis-actions">
                <div className="persona-popover-shell" ref={popoverRef}>
                  <button
                    className="secondary-button"
                    disabled={isPersonaLoading || Boolean(personaError)}
                    onClick={() => setIsPopoverOpen((current) => !current)}
                    type="button"
                  >
                    페르소나 선택
                  </button>
                  {isPopoverOpen ? (
                    <div className="persona-popover">
                      <div className="persona-popover-header">
                        <strong>토론자 선택</strong>
                        <span className="muted">{selectionCount}/4 선택됨</span>
                      </div>
                      <p className="persona-popover-copy">
                        최소 2명, 최대 4명까지 선택할 수 있습니다. 진행자는 항상 고정으로 참여합니다.
                      </p>
                      <div className="persona-option-grid">
                        {personas.map((persona) => {
                          const isSelected = selectedPersonaIds.includes(persona.id);
                          const isDisabled = !isSelected && selectionCount >= 4;

                          return (
                            <button
                              className={`persona-option ${isSelected ? "selected" : ""}`}
                              disabled={isDisabled}
                              key={persona.id}
                              onClick={() => togglePersona(persona.id)}
                              type="button"
                            >
                              <span className={`speaker-badge ${persona.name}`}>
                                {persona.label}
                              </span>
                              <span>{persona.description}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
                <button
                  className="primary-button"
                  disabled={isPending || isPersonaLoading || !isSelectionValid || Boolean(personaError)}
                  onClick={() => startTransition(() => void createFreshAnalysis())}
                  type="button"
                >
                  토론 시작
                </button>
              </div>
            ) : session ? (
              <div className="control-row">
                <button className="secondary-button" onClick={() => setShowReport(true)} type="button">
                  즉시 결과 보기
                </button>
                <button
                  className="secondary-button"
                  disabled={!session}
                  onClick={() => session && startReplay(session.id)}
                  type="button"
                >
                  토론 다시 재생
                </button>
                <button
                  className="primary-button"
                  disabled={isPending}
                  onClick={() => startTransition(() => void createFreshAnalysis())}
                  type="button"
                >
                  같은 종목 다시 분석
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {personaError ? <div className="alert-error">{personaError}</div> : null}
        {error ? <div className="alert-error">{error}</div> : null}

        {!session && !isStreaming ? (
          <div className="empty-state">
            <strong>토론을 시작할 준비가 되었습니다.</strong>
            <p>
              우측 상단에서 페르소나를 선택한 뒤 토론 시작을 누르면 AI 토론이 진행됩니다.
            </p>
            <div className="tag-row">
              <span className="tag">최소 2명</span>
              <span className="tag">최대 4명</span>
              <span className="tag">진행자 고정 참여</span>
            </div>
          </div>
        ) : null}

        {!session && isPersonaLoading ? (
          <div className="typing-indicator">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
            <span>토론에 참여할 페르소나를 불러오는 중입니다.</span>
          </div>
        ) : null}

        <div className="messages">
          {liveMessages.map((message) => (
            <article className="message-card" key={message.id}>
              <div className="message-meta">
                <div>
                  <span className={`speaker-badge ${message.role}`}>{roleLabel(message.role)}</span>
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
          ))}

          {isStreaming ? (
            <div className="typing-indicator">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <span>선택한 전문가들이 다음 발언을 정리하고 있습니다.</span>
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
                  <p className="eyebrow">AI 타이밍 카드</p>
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
                유효기간:{" "}
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
                  <p className="eyebrow">근거 데이터</p>
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
        ) : null}
      </aside>

      {session && showReport ? (
        <section className="panel report-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">최종 정보 종합</p>
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
