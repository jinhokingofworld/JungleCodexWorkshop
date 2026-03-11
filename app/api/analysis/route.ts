import { NextRequest, NextResponse } from "next/server";
import { createNewAnalysis } from "@/lib/server/analysis-service";
import { evaluateGuard, recordGuardEvent } from "@/lib/server/guards";
import type { CreateAnalysisInput } from "@/lib/types";

export const dynamic = "force-dynamic";

function getIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")
  );
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as CreateAnalysisInput;
  const ip = getIp(request);
  const decision = evaluateGuard(ip);

  recordGuardEvent(ip, decision.mode, decision.reason);

  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.reason ?? "Request blocked" },
      { status: 429 }
    );
  }

  try {
    const session = await createNewAnalysis({
      market: payload.market,
      symbol: payload.symbol,
      userQuestion: payload.userQuestion,
      forceFresh: payload.forceFresh ?? true
    });

    return NextResponse.json({ session });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error ? cause.message : "분석 생성에 실패했습니다."
      },
      { status: 400 }
    );
  }
}
