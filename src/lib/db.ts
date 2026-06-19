// @ts-ignore
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = path.join(process.cwd(), "repomind.db");

// Establish connection
export const db = new DatabaseSync(DB_PATH);

// Initialize DB schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      github_id TEXT,
      name TEXT,
      avatar_url TEXT,
      plan TEXT DEFAULT 'free',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT,
      github_url TEXT NOT NULL,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      default_branch TEXT DEFAULT 'main',
      is_private INTEGER DEFAULT 0,
      last_synced_sha TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      requested_by TEXT,
      status TEXT NOT NULL, -- 'pending', 'cloning', 'parsing', 'analyzing', 'completed', 'failed'
      commit_sha TEXT,
      started_at TEXT,
      completed_at TEXT,
      total_cost_usd REAL DEFAULT 0.0,
      config_json TEXT,
      FOREIGN KEY(repository_id) REFERENCES repositories(id)
    );

    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id TEXT PRIMARY KEY,
      analysis_id TEXT NOT NULL,
      agent_type TEXT NOT NULL, -- 'architecture', 'readme', 'bug', 'security', 'suggestions'
      status TEXT NOT NULL, -- 'pending', 'running', 'completed', 'failed'
      model_used TEXT,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      FOREIGN KEY(analysis_id) REFERENCES analyses(id)
    );

    CREATE TABLE IF NOT EXISTS analysis_findings (
      id TEXT PRIMARY KEY,
      analysis_id TEXT NOT NULL,
      agent_type TEXT NOT NULL,
      file_path TEXT,
      line_start INTEGER,
      line_end INTEGER,
      severity TEXT, -- 'critical', 'high', 'medium', 'low'
      category TEXT,
      title TEXT NOT NULL,
      description TEXT,
      suggested_fix TEXT,
      confidence REAL,
      FOREIGN KEY(analysis_id) REFERENCES analyses(id)
    );

    CREATE TABLE IF NOT EXISTS generated_readmes (
      id TEXT PRIMARY KEY,
      analysis_id TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(analysis_id) REFERENCES analyses(id)
    );

    CREATE TABLE IF NOT EXISTS llm_providers (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      base_url TEXT,
      auth_type TEXT NOT NULL -- 'bearer' | 'none'
    );

    CREATE TABLE IF NOT EXISTS llm_models (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      context_window INTEGER DEFAULT 8192,
      max_output_tokens INTEGER DEFAULT 2048,
      input_cost_per_1m REAL DEFAULT 0,
      output_cost_per_1m REAL DEFAULT 0,
      supports_vision INTEGER DEFAULT 0,
      supports_function_calling INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY(provider_id) REFERENCES llm_providers(id)
    );

    CREATE TABLE IF NOT EXISTS user_api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      iv TEXT NOT NULL,
      last_validated_at TEXT,
      is_valid INTEGER DEFAULT 1,
      FOREIGN KEY(provider_id) REFERENCES llm_providers(id)
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      analysis_id TEXT,
      user_id TEXT,
      model_id TEXT NOT NULL,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0.0,
      latency_ms INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      user_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(repository_id) REFERENCES repositories(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL, -- 'user' | 'assistant'
      content TEXT NOT NULL,
      cited_files_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(session_id) REFERENCES chat_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS code_embeddings (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding_json TEXT NOT NULL, -- JSON string array of floats
      commit_sha TEXT,
      FOREIGN KEY(repository_id) REFERENCES repositories(id)
    );

    CREATE TABLE IF NOT EXISTS repository_files (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY(repository_id) REFERENCES repositories(id)
    );
  `);

  // Run dynamic schema migrations
  try {
    db.exec("ALTER TABLE analyses ADD COLUMN code_map_json TEXT");
  } catch (e) {
    // Column already exists
  }

  // Seed default providers and models if empty
  const providersCount = db.prepare("SELECT COUNT(*) as count FROM llm_providers").get() as { count: number };
  if (providersCount.count === 0) {
    seedProvidersAndModels();
  }
}

function seedProvidersAndModels() {
  const insertProvider = db.prepare(`
    INSERT INTO llm_providers (id, slug, display_name, base_url, auth_type)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertModel = db.prepare(`
    INSERT INTO llm_models (id, provider_id, model_id, display_name, context_window, max_output_tokens, input_cost_per_1m, output_cost_per_1m, supports_vision, supports_function_calling, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const providers = [
    { id: "p1", slug: "openai", name: "OpenAI", url: "https://api.openai.com/v1", auth: "bearer" },
    { id: "p2", slug: "anthropic", name: "Anthropic", url: "https://api.anthropic.com/v1", auth: "bearer" },
    { id: "p3", slug: "google", name: "Google Gemini", url: "https://generativelanguage.googleapis.com/v1beta", auth: "bearer" },
    { id: "p4", slug: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/api/v1", auth: "bearer" },
    { id: "p5", slug: "ollama", name: "Ollama (Local)", url: "http://localhost:11434/v1", auth: "none" }
  ];

  for (const p of providers) {
    insertProvider.run(p.id, p.slug, p.name, p.url, p.auth);
  }

  const models = [
    // OpenAI
    { id: "m1", provider: "p1", model_id: "gpt-4o", name: "GPT-4o", context: 128000, max_out: 4096, cost_in: 2.5, cost_out: 10.0, vision: 1, fn: 1 },
    { id: "m2", provider: "p1", model_id: "gpt-4o-mini", name: "GPT-4o Mini", context: 128000, max_out: 16384, cost_in: 0.150, cost_out: 0.600, vision: 1, fn: 1 },
    // Anthropic
    { id: "m3", provider: "p2", model_id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet", context: 200000, max_out: 8192, cost_in: 3.0, cost_out: 15.0, vision: 1, fn: 1 },
    { id: "m4", provider: "p2", model_id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku", context: 200000, max_out: 4096, cost_in: 0.8, cost_out: 4.0, vision: 0, fn: 1 },
    // Google
    { id: "m5", provider: "p3", model_id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", context: 2000000, max_out: 8192, cost_in: 1.25, cost_out: 5.0, vision: 1, fn: 1 },
    { id: "m6", provider: "p3", model_id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", context: 1000000, max_out: 8192, cost_in: 0.075, cost_out: 0.3, vision: 1, fn: 1 },
    { id: "m7", provider: "p3", model_id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash Exp", context: 1000000, max_out: 8192, cost_in: 0.0, cost_out: 0.0, vision: 1, fn: 1 },
    // OpenRouter
    { id: "m8", provider: "p4", model_id: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B Instruct (OpenRouter)", context: 131072, max_out: 4096, cost_in: 0.52, cost_out: 0.75, vision: 0, fn: 0 },
    { id: "m9", provider: "p4", model_id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (OpenRouter)", context: 200000, max_out: 8192, cost_in: 3.0, cost_out: 15.0, vision: 1, fn: 1 },
    { id: "m10", provider: "p4", model_id: "google/gemini-flash-1.5", name: "Gemini 1.5 Flash (OpenRouter)", context: 280000, max_out: 8192, cost_in: 0.075, cost_out: 0.3, vision: 1, fn: 1 },
    // Ollama
    { id: "m11", provider: "p5", model_id: "llama3", name: "Llama 3 (Local)", context: 8192, max_out: 2048, cost_in: 0.0, cost_out: 0.0, vision: 0, fn: 0 },
    { id: "m12", provider: "p5", model_id: "mistral", name: "Mistral (Local)", context: 8192, max_out: 2048, cost_in: 0.0, cost_out: 0.0, vision: 0, fn: 0 },
    { id: "m13", provider: "p5", model_id: "qwen2", name: "Qwen 2 (Local)", context: 32768, max_out: 4096, cost_in: 0.0, cost_out: 0.0, vision: 0, fn: 0 }
  ];

  for (const m of models) {
    insertModel.run(
      m.id,
      m.provider,
      m.model_id,
      m.name,
      m.context,
      m.max_out,
      m.cost_in,
      m.cost_out,
      m.vision,
      m.fn
    );
  }
}

// Initialise DB immediately on module load
initDb();
