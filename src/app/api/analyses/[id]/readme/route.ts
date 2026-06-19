import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const readme = db.prepare(`
      SELECT * FROM generated_readmes 
      WHERE analysis_id = ? 
      ORDER BY version DESC LIMIT 1
    `).get(id) as any;

    if (!readme) {
      return NextResponse.json({ error: { message: "README not found for this analysis." } }, { status: 404 });
    }

    return NextResponse.json(readme);
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { content } = await req.json();

    if (!content) {
      return NextResponse.json({ error: { message: "Content is required." } }, { status: 400 });
    }

    // Get current version
    const lastReadme = db.prepare(`
      SELECT version FROM generated_readmes 
      WHERE analysis_id = ? 
      ORDER BY version DESC LIMIT 1
    `).get(id) as { version: number } | undefined;

    const newVersion = (lastReadme?.version || 0) + 1;

    db.prepare(`
      INSERT INTO generated_readmes (id, analysis_id, content_markdown, version)
      VALUES (?, ?, ?, ?)
    `).run(crypto.randomUUID(), id, content, newVersion);

    const updated = db.prepare(`
      SELECT * FROM generated_readmes 
      WHERE analysis_id = ? 
      ORDER BY version DESC LIMIT 1
    `).get(id);

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
