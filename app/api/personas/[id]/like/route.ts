import { NextResponse } from "next/server";
import {
  registerPersonaLike,
  unregisterPersonaLike
} from "@/lib/server/analysis-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const persona = await registerPersonaLike(id);

  if (!persona) {
    return NextResponse.json({ error: "Persona not found." }, { status: 404 });
  }

  return NextResponse.json({ persona });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const persona = await unregisterPersonaLike(id);

  if (!persona) {
    return NextResponse.json({ error: "Persona not found." }, { status: 404 });
  }

  return NextResponse.json({ persona });
}
