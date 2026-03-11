import { describe, expect, it } from "vitest";
import { buildEvidenceBundle } from "@/lib/server/providers";

describe("evidence bundle", () => {
  it("returns fallback-backed evidence for KR symbols without API keys", async () => {
    const bundle = await buildEvidenceBundle("KR", "005930");

    expect(bundle.symbol.name).toBe("삼성전자");
    expect(bundle.items.length).toBeGreaterThanOrEqual(3);
    expect(bundle.items.some((item) => item.kind === "price")).toBe(true);
  });

  it("returns fallback-backed evidence for US symbols without API keys", async () => {
    const bundle = await buildEvidenceBundle("US", "TSLA");

    expect(bundle.symbol.name).toBe("Tesla");
    expect(bundle.items.some((item) => item.source === "AlphaVantage")).toBe(true);
  });
});
