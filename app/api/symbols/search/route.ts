import { NextRequest, NextResponse } from "next/server";
import { symbolCatalog } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (!query) {
    return NextResponse.json({ items: [] });
  }

  const items = symbolCatalog
    .filter((item) => {
      return (
        item.symbol.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.exchange.toLowerCase().includes(query)
      );
    })
    .slice(0, 8);

  return NextResponse.json({ items });
}
