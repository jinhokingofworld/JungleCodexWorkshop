import { NextResponse } from "next/server";
import { listRecentSessions } from "@/lib/server/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = await listRecentSessions(12);
  return NextResponse.json({ sessions });
}
