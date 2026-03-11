import { NextRequest, NextResponse } from "next/server";
import { marketOverviewCatalog } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region")?.toUpperCase();

  if (region !== "KR" && region !== "US") {
    return NextResponse.json(
      { error: "region must be KR or US" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    overview: marketOverviewCatalog[region]
  });
}
