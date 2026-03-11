import { NextResponse } from "next/server";
import { listPopularSessions } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = await listPopularSessions(12);
  return NextResponse.json({ sessions });
}
