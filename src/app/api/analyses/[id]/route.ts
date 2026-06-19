import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activeJobsProgress } from "@/lib/worker";

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

    const repo = db.prepare("SELECT * FROM repositories WHERE id = ?").get(analysis.repository_id);
    const jobs = db.prepare("SELECT * FROM analysis_jobs WHERE analysis_id = ?").all();
    
    // Parse the code map structure
    const codeMap = analysis.code_map_json ? JSON.parse(analysis.code_map_json) : null;

    // Get live status from memory log if running
    const progressInfo = activeJobsProgress[id] || {
      percent: analysis.status === "completed" ? 100 : analysis.status === "failed" ? 100 : 0,
      status: analysis.status,
      log: [`Job status is: ${analysis.status}`]
    };

    return NextResponse.json({
      analysis,
      repository: repo,
      jobs,
      codeMap,
      progress: {
        percent: progressInfo.percent,
        status: progressInfo.status,
        logs: progressInfo.log
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
