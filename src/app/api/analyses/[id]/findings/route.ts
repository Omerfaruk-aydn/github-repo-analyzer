import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const analysis = db.prepare("SELECT * FROM analyses WHERE id = ?").get(id) as any;
    if (!analysis) {
      return NextResponse.json({ error: { message: "Analysis not found." } }, { status: 404 });
    }

    const findings = db.prepare("SELECT * FROM analysis_findings WHERE analysis_id = ?").all();

    return NextResponse.json({ findings });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
