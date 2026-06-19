import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      return NextResponse.json({ error: { message: "path search parameter is required." } }, { status: 400 });
    }

    // Fetch the file text from database
    const fileRow = db.prepare(`
      SELECT content FROM repository_files 
      WHERE repository_id = ? AND file_path = ?
    `).get(id, filePath) as { content: string } | undefined;

    if (!fileRow) {
      return NextResponse.json({ error: { message: `File "${filePath}" not found in database.` } }, { status: 404 });
    }

    return NextResponse.json({ content: fileRow.content });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
