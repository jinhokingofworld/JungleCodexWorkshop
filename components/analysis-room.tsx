"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { AnalysisSession, DebateMessage, Market } from "@/lib/types";
import { roleLabel } from "@/lib/server/utils";

interface AnalysisRoomProps {
  market: Market;
  symbol: string;
  symbolName: string;
  initialSession?: AnalysisSession | null;
}

interface CreateAnalysisResponse {
  session: AnalysisSession;
}

export function AnalysisRoom({
  market,
  symbol,
  symbolName,
  initialSession = null
}: AnalysisRoomProps) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isPending, startTransition] = useTransition();
  const [session, setSession] = useState<AnalysisSession | null>(initialSession);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showReport, setShowReport] = useState(Boolean(initialSession));
  const [error, setError] = useState<string | null>(null);

  const evidenceMap = useMemo(() => {
    if (!session) {
      return new Map();
    }

    return new Map(session.evidence.map((item) => [item.id, item]));
  }, [session]);

  useEffect(() => {
    if (initialSession) {
      setSession(initialSession);
      setMessages([]);
      setShowReport(true);
      startReplay(initialSession.id);
      return () => closeStream();
    }

    startTransition(() => {
      void createFreshAnalysis();
    });

    return () => closeStream();
  }, [initialSession, market, symbol]);

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
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          market,
          symbol,
          forceFresh: true
        })
      });

      if (!response.ok) {
        throw new Error("분석 생성에 실패했습니다.");
      }

      const payload = (await response.json()) as CreateAnalysisResponse;
      setSession(payload.session);
      startReplay(payload.session.id);
    } catch (cause) {
      setIsStreaming(false);
      setError(cause instanceof Error ? cause.message : "알 수 없는 오류");
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
      setIsStreaming(false);
      eventSource.close();
    };
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
          <div className="control-row">
            <button className="secondary-button" onClick={() => setShowReport(true)} type="button">
              즉시 결론 보기
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
        </div>

        {error ? <div className="alert-error">{error}</div> : null}

        <div className="messages">
          {liveMessages.map((message) => (
            <article className="message-card" key={message.id}>
              <div className="message-meta">
                <div>
                  <span className={`speaker-badge ${message.role}`}>{roleLabel(message.role)}</span>
                  <span className="message-stance">{message.stance}</span>
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
              <span>전문가들이 다음 의견을 정리 중입니다.</span>
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
                  <h3>출처 패널</h3>
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
            <ReportItem label="한 줄 결론" value={session.finalReport.overallView} />
            <ReportItem label="상승 시나리오" value={session.finalReport.bullCase} />
            <ReportItem label="하락 시나리오" value={session.finalReport.bearCase} />
            <ReportList label="핵심 리스크" values={session.finalReport.risks} />
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
