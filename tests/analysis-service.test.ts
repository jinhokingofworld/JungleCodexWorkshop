import { describe, expect, it } from "vitest";
import { createNewAnalysis, listPersonas } from "@/lib/server/analysis-service";

describe("analysis generation", () => {
  it("creates a fresh analysis with selected personas and matching roles", async () => {
    const personas = await listPersonas();
    const selected = personas.slice(0, 4);

    const session = await createNewAnalysis({
      market: "KR",
      symbol: "005930",
      personaIds: selected.map((persona) => persona.id),
      forceFresh: true
    });

    expect(session.market).toBe("KR");
    expect(session.selectedPersonas.map((persona) => persona.id)).toEqual(
      selected.map((persona) => persona.id)
    );
    expect(session.messages).toHaveLength(10);
    expect(session.evidence.length).toBeGreaterThan(0);
    expect(session.timingCard.buyZone.label.length).toBeGreaterThan(0);
    expect(session.finalReport.overallView.length).toBeGreaterThan(10);

    const allowedRoles = new Set(["host", ...selected.map((persona) => persona.name)]);
    expect(session.messages.every((message) => allowedRoles.has(message.role))).toBe(true);
  });

  it("supports smaller 2-persona debates for US symbols", async () => {
    const personas = await listPersonas();
    const selected = personas.slice(0, 2);

    const session = await createNewAnalysis({
      market: "US",
      symbol: "NVDA",
      personaIds: selected.map((persona) => persona.id),
      forceFresh: true
    });

    expect(session.market).toBe("US");
    expect(session.overview.exchange).toBe("NASDAQ");
    expect(session.messages).toHaveLength(6);
    expect(session.messages.every((message) => message.evidenceIds.length > 0)).toBe(true);
  });

  it("threads an optional user question into the debate and report", async () => {
    const personas = await listPersonas();
    const question = "전쟁과 삼성전자가 관련이 있을지도 생각해줘";
    const selected = personas.filter((persona) =>
      ["krAnalyst", "globalAnalyst", "macroEconomist"].includes(persona.name)
    );

    const session = await createNewAnalysis({
      market: "KR",
      symbol: "005930",
      personaIds: selected.map((persona) => persona.id),
      userQuestion: question,
      forceFresh: true
    });

    expect(session.optionalQuestion).toBe(question);
    expect(session.messages[0]?.role).toBe("host");
    expect(session.messages[0]?.text).toContain("전쟁");

    const globalMessages = session.messages.filter((message) => message.role === "globalAnalyst");
    const macroMessages = session.messages.filter((message) => message.role === "macroEconomist");

    expect(globalMessages).toHaveLength(2);
    expect(macroMessages).toHaveLength(2);
    expect(globalMessages.every((message) => message.text.includes("전쟁"))).toBe(true);
    expect(macroMessages.every((message) => message.text.includes("전쟁"))).toBe(true);
    expect(session.finalReport.questionAnswer).toContain("전쟁");
  });

  it("rejects invalid persona counts and invalid ids", async () => {
    const personas = await listPersonas();

    await expect(
      createNewAnalysis({
        market: "KR",
        symbol: "005930",
        personaIds: [personas[0].id],
        forceFresh: true
      })
    ).rejects.toThrow("Select between 2 and 4 personas");

    await expect(
      createNewAnalysis({
        market: "KR",
        symbol: "005930",
        personaIds: [personas[0].id, personas[0].id],
        forceFresh: true
      })
    ).rejects.toThrow("Duplicate personas");

    await expect(
      createNewAnalysis({
        market: "KR",
        symbol: "005930",
        personaIds: [personas[0].id, "ffffffffffffffffffffffff"],
        forceFresh: true
      })
    ).rejects.toThrow("invalid");
  });
});
