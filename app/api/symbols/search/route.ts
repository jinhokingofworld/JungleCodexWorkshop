import { NextRequest, NextResponse } from "next/server";
import { searchLiveSymbols } from "@/lib/server/market-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (!query) {
    return NextResponse.json({ items: [] });
  }

  return NextResponse.json({ items: await searchLiveSymbols(query) });
}
