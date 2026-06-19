import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeLLMCall, UnifiedMessage } from "@/lib/llm";
import crypto from "node:crypto";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const repositoryId = searchParams.get("repositoryId");

    let messages = [];

    if (sessionId) {
      messages = db.prepare(`
        SELECT * FROM chat_messages 
        WHERE session_id = ? 
        ORDER BY created_at ASC
      `).all(sessionId) as any[];
    } else if (repositoryId) {
      // Find latest session for this repo
      const session = db.prepare(`
        SELECT id FROM chat_sessions 
        WHERE repository_id = ? 
        ORDER BY created_at DESC LIMIT 1
      `).get(repositoryId) as { id: string } | undefined;

      if (session) {
        messages = db.prepare(`
          SELECT * FROM chat_messages 
          WHERE session_id = ? 
          ORDER BY created_at ASC
        `).all(session.id) as any[];
      }
    }

    const formattedMessages = messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      citedFiles: m.cited_files_json ? JSON.parse(m.cited_files_json) : [],
      created_at: m.created_at
    }));

    return NextResponse.json({ messages: formattedMessages });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { repositoryId, sessionId: reqSessionId, message, modelId = "m2" } = await req.json();

    if (!repositoryId || !message) {
      return NextResponse.json({ error: { message: "repositoryId and message are required." } }, { status: 400 });
    }

    // 1. Get or create session
    let sessionId = reqSessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO chat_sessions (id, repository_id, user_id)
        VALUES (?, ?, ?)
      `).run(sessionId, repositoryId, "default-user");
    }

    // Save user message
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content)
      VALUES (?, ?, 'user', ?)
    `).run(crypto.randomUUID(), sessionId, message);

    // 2. Fetch code chunks for RAG search
    const chunks = db.prepare(`
      SELECT file_path, chunk_index, content 
      FROM code_embeddings 
      WHERE repository_id = ?
    `).all(repositoryId) as Array<{ file_path: string; chunk_index: number; content: string }>;

    // Perform local keyword-based relevance matching
    const queryWords = message.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
    const scoredChunks = chunks.map(chunk => {
      let score = 0;
      const lowerContent = chunk.content.toLowerCase();
      queryWords.forEach((word: string) => {
        if (lowerContent.includes(word)) score += 1;
        // Boost matches in file path
        if (chunk.file_path.toLowerCase().includes(word)) score += 3;
      });
      return { chunk, score };
    });

    // Sort by score descending and take top 4
    const relevantChunks = scoredChunks
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(item => item.chunk);

    // If no keyword matches, just take the first 3 files
    const finalContextChunks = relevantChunks.length > 0 
      ? relevantChunks 
      : chunks.slice(0, 3);

    // Construct context text
    const contextText = finalContextChunks.map(c => 
      `--- FILE: ${c.file_path} (Chunk ${c.chunk_index}) ---\n${c.content}`
    ).join("\n\n");

    // 3. Generate Answer
    // Check if user has credentials setup for this model
    const modelRow = db.prepare("SELECT provider_id FROM llm_models WHERE id = ?").get(modelId) as any;
    const keyRow = modelRow ? db.prepare("SELECT id FROM user_api_keys WHERE user_id = ? AND provider_id = ?").get("default-user", modelRow.provider_id) : null;
    const hasKeys = !!keyRow || (modelRow?.provider_id === "p5");

    let answer = "";
    const citedFiles = Array.from(new Set(finalContextChunks.map(c => c.file_path)));

    if (hasKeys) {
      const sysPrompt = `You are RepoMind's AI assistant. Answer the user's question about the repository using the provided code context.
If the context does not contain enough information to answer, state that.
Be specific, reference exact files, variables, and line numbers.

=== CODE CONTEXT ===
${contextText}`;

      const res = await executeLLMCall("default-user", modelId, {
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: message }
        ]
      });
      answer = res.content;
    } else {
      // High-quality simulation response based on actual retrieved code content
      answer = simulateChatResponse(message, finalContextChunks);
    }

    // Save assistant message
    const msgId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, cited_files_json)
      VALUES (?, ?, 'assistant', ?, ?)
    `).run(msgId, sessionId, answer, JSON.stringify(citedFiles));

    return NextResponse.json({
      sessionId,
      message: {
        id: msgId,
        role: "assistant",
        content: answer,
        citedFiles,
        created_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}

function simulateChatResponse(query: string, chunks: any[]): string {
  if (chunks.length === 0) {
    return "I couldn't find any code files indexed for this repository. Please run an analysis first so I can inspect the code.";
  }

  const fileNames = Array.from(new Set(chunks.map(c => c.file_path)));
  
  let codeSnippetDesc = "";
  chunks.forEach(c => {
    // Look at first 2 lines of content to describe
    const firstLines = c.content.split("\n").slice(0, 3).join("\n  ");
    codeSnippetDesc += `\n- **${c.file_path}** contains: \n  \`\`\`\n  ${firstLines}\n  \`\`\`\n`;
  });

  return `Based on the repository context (specifically files: ${fileNames.join(", ")}):

I searched the codebase for your query. Here is what I discovered:
${codeSnippetDesc}

*(Note: To get deep, real-time AI reasoning on your actual logic, please add your API key in the Settings page. This response was compiled locally using keyword mapping on the parsed files)*`;
}
