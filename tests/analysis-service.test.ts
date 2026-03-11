import { describe, expect, it } from "vitest";
import { getDefaultSelectedPersonas } from "@/lib/personas";
import { createNewAnalysis } from "@/lib/server/analysis-service";

describe("analysis generation", () => {
  it("creates a fresh analysis with personas, timing card, and final report", async () => {
    const session = await createNewAnalysis({
      market: "KR",
      personas: getDefaultSelectedPersonas("KR"),
      symbol: "005930",
      forceFresh: true
    });

    expect(session.market).toBe("KR");
    expect(session.personas.length).toBeGreaterThanOrEqual(2);
    expect(session.messages.length).toBeGreaterThanOrEqual(5);
    expect(session.evidence.length).toBeGreaterThan(0);
    expect(session.timingCard.buyZone.label).toBe("매수 관심 구간");
    expect(session.finalReport.overallView.length).toBeGreaterThan(10);
    expect(session.messages.every((message) => message.speakerPersonaId.length > 0)).toBe(true);
  });

  it("supports US symbols with the same public schema", async () => {
    const session = await createNewAnalysis({
      market: "US",
      personas: getDefaultSelectedPersonas("US"),
      symbol: "NVDA",
      forceFresh: true
    });

    expect(session.market).toBe("US");
    expect(session.overview.exchange).toBe("NASDAQ");
    expect(session.messages.every((message) => message.evidenceIds.length > 0)).toBe(true);
  });

  it("auto-injects the host when selections omit it", async () => {
    const session = await createNewAnalysis({
      market: "KR",
      personas: getDefaultSelectedPersonas("KR").filter(
        (persona) => persona.presetRole !== "host"
      ),
      symbol: "005930",
      forceFresh: true
    });

    expect(session.personas[0]?.presetRole).toBe("host");
  });
});
