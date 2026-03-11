import { NextRequest, NextResponse } from "next/server";
import { symbolCatalog } from "@/lib/mock-data";
import { fetchHomeStockSnapshot } from "@/lib/server/home-stocks";
import { getStocksRepository, toStockDocument } from "@/lib/server/stocks-repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repository = getStocksRepository();
  const now = new Date();

  const results = await Promise.allSettled(
    symbolCatalog.map(async (profile) => {
      const refreshed = await fetchHomeStockSnapshot(profile);
      if (!refreshed) return null;
      return repository
        ? repository.upsertStock(toStockDocument(refreshed, now))
        : toStockDocument(refreshed, now);
    })
  );

  const updated = results.filter(
    (r) => r.status === "fulfilled" && r.value !== null
  ).length;

  return NextResponse.json({ updated, total: symbolCatalog.length });
}
