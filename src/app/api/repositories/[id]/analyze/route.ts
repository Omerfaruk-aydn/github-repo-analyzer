import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startWorker } from "@/lib/queue";
import crypto from "node:crypto";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { modelId, githubToken } = body;

    // Check if repo exists
    const repo = db.prepare("SELECT * FROM repositories WHERE id = ?").get(id) as any;
    if (!repo) {
      return NextResponse.json({ error: { message: "Repository not found." } }, { status: 404 });
    }

    const analysisId = crypto.randomUUID();
    const configJson = JSON.stringify({
      modelId: modelId || "m2",
      githubToken: githubToken || ""
    });

    db.prepare(`
      INSERT INTO analyses (id, repository_id, requested_by, status, total_cost_usd, config_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(analysisId, id, "default-user", "pending", 0.0, configJson);

    // Start background worker loop if not already running
    startWorker();

    const analysis = db.prepare("SELECT * FROM analyses WHERE id = ?").get(analysisId);
    return NextResponse.json(analysis);
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
