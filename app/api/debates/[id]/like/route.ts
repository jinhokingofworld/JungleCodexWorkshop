import { NextResponse } from "next/server";
import {
  registerSessionLike,
  unregisterSessionLike
} from "@/lib/server/analysis-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await registerSessionLike(id);

  if (!session) {
    return NextResponse.json({ error: "Debate not found." }, { status: 404 });
  }

  return NextResponse.json({ id: session.id, likes: session.likes });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await unregisterSessionLike(id);

  if (!session) {
    return NextResponse.json({ error: "Debate not found." }, { status: 404 });
  }

  return NextResponse.json({ id: session.id, likes: session.likes });
}
