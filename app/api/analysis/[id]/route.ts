import { NextResponse } from "next/server";
import { getAnalysisSession } from "@/lib/server/analysis-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getAnalysisSession(id);
    return NextResponse.json({ session });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error ? cause.message : "세션을 찾을 수 없습니다."
      },
      { status: 404 }
    );
  }
}
