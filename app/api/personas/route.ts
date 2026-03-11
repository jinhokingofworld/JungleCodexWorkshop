import { NextResponse } from "next/server";
import { listPersonas } from "@/lib/server/analysis-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const personas = await listPersonas();
    return NextResponse.json({ personas });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error ? cause.message : "Failed to load personas."
      },
      { status: 500 }
    );
  }
}
