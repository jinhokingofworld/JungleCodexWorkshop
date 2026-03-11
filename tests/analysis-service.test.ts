import { describe, expect, it } from "vitest";
import { createNewAnalysis } from "@/lib/server/analysis-service";

describe("analysis generation", () => {
  it("creates a fresh analysis with debate, timing card, and final report", async () => {
    const session = await createNewAnalysis({
      market: "KR",
      symbol: "005930",
      forceFresh: true
    });

    expect(session.market).toBe("KR");
    expect(session.messages.length).toBeGreaterThanOrEqual(8);
    expect(session.messages.length).toBeLessThanOrEqual(10);
    expect(session.evidence.length).toBeGreaterThan(0);
    expect(session.timingCard.buyZone.label).toBe("매수 관심구간");
    expect(session.finalReport.overallView.length).toBeGreaterThan(10);
  });

  it("supports US symbols with the same public schema", async () => {
    const session = await createNewAnalysis({
      market: "US",
      symbol: "NVDA",
      forceFresh: true
    });

    expect(session.market).toBe("US");
    expect(session.overview.exchange).toBe("NASDAQ");
    expect(session.messages.every((message) => message.evidenceIds.length > 0)).toBe(true);
  });
});
