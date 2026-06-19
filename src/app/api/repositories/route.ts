import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "node:crypto";

export async function POST(req: Request) {
  try {
    const { githubUrl } = await req.json();
    if (!githubUrl) {
      return NextResponse.json({ error: { message: "githubUrl is required" } }, { status: 400 });
    }

    // Clean and validate URL
    const cleanedUrl = githubUrl.replace(/\.git$/, "").trim();
    
    let owner = "";
    let name = "";
    
    const standardMatch = cleanedUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+)/);
    const rawMatch = cleanedUrl.match(/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)/);
    
    if (standardMatch) {
      owner = standardMatch[1];
      name = standardMatch[2];
    } else if (rawMatch) {
      owner = rawMatch[1];
      name = rawMatch[2];
    } else {
      return NextResponse.json({ error: { message: "Invalid GitHub URL format. Must contain github.com/owner/repo" } }, { status: 400 });
    }

    // Check if repo already exists
    let repo = db.prepare("SELECT * FROM repositories WHERE github_url = ?").get(cleanedUrl) as any;
    
    if (!repo) {
      const repoId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO repositories (id, owner_user_id, github_url, owner, name)
        VALUES (?, ?, ?, ?, ?)
      `).run(repoId, "default-user", cleanedUrl, owner, name);
      
      repo = db.prepare("SELECT * FROM repositories WHERE id = ?").get(repoId);
    }

    return NextResponse.json(repo);
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
