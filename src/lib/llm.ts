import crypto from "node:crypto";
import { decrypt } from "./crypto";
import { db } from "./db";

export interface UnifiedMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface UnifiedRequest {
  model?: string;
  messages: UnifiedMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface UnifiedResponse {
  content: string;
  usage: TokenUsage;
}

export interface UnifiedChunk {
  content: string;
  done: boolean;
}

export interface ModelInfo {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  supportsVision: boolean;
  supportsFunctionCalling: boolean;
}

export interface LLMProviderAdapter {
  id: string;
  complete(req: UnifiedRequest, apiKey?: string): Promise<UnifiedResponse>;
  countTokens(text: string): number;
  estimateCost(usage: TokenUsage, modelInfo: ModelInfo): number;
}

// Simple token counter approximation (4 characters per token as a fallback)
function approximateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

// Adapters
class OpenAIAdapter implements LLMProviderAdapter {
  id = "openai";

  async complete(req: UnifiedRequest, apiKey?: string): Promise<UnifiedResponse> {
    if (!apiKey) throw new Error("OpenAI API Key is required.");
    
    const body: any = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
    };

    if (req.maxTokens) body.max_tokens = req.maxTokens;
    if (req.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    return {
      content: data.choices[0].message.content || "",
      usage: {
        promptTokens: data.usage?.prompt_tokens || approximateTokenCount(JSON.stringify(req.messages)),
        completionTokens: data.usage?.completion_tokens || approximateTokenCount(data.choices[0].message.content || "")
      }
    };
  }

  countTokens(text: string): number {
    return approximateTokenCount(text);
  }

  estimateCost(usage: TokenUsage, modelInfo: ModelInfo): number {
    return (usage.promptTokens * modelInfo.inputCostPer1M + usage.completionTokens * modelInfo.outputCostPer1M) / 1000000;
  }
}

class AnthropicAdapter implements LLMProviderAdapter {
  id = "anthropic";

  async complete(req: UnifiedRequest, apiKey?: string): Promise<UnifiedResponse> {
    if (!apiKey) throw new Error("Anthropic API Key is required.");

    // Extract system message
    const systemMessage = req.messages.find(m => m.role === "system")?.content;
    const userMessages = req.messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role === "assistant" ? "assistant" as const : "user" as const,
        content: m.content
      }));

    const body: any = {
      model: req.model,
      messages: userMessages,
      max_tokens: req.maxTokens || 4000,
      temperature: req.temperature ?? 0.2
    };

    if (systemMessage) {
      body.system = systemMessage;
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    const content = data.content.map((c: any) => c.text).join("");
    return {
      content,
      usage: {
        promptTokens: data.usage?.input_tokens || approximateTokenCount(JSON.stringify(req.messages)),
        completionTokens: data.usage?.output_tokens || approximateTokenCount(content)
      }
    };
  }

  countTokens(text: string): number {
    return approximateTokenCount(text);
  }

  estimateCost(usage: TokenUsage, modelInfo: ModelInfo): number {
    return (usage.promptTokens * modelInfo.inputCostPer1M + usage.completionTokens * modelInfo.outputCostPer1M) / 1000000;
  }
}

class GeminiAdapter implements LLMProviderAdapter {
  id = "google";

  async complete(req: UnifiedRequest, apiKey?: string): Promise<UnifiedResponse> {
    if (!apiKey) throw new Error("Gemini API Key is required.");

    // Extract system instruction
    const systemMessage = req.messages.find(m => m.role === "system")?.content;
    
    // Map roles to Gemini roles ('user' or 'model')
    const contents = req.messages
      .filter(m => m.role !== "system")
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

    const body: any = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxTokens ?? 8192
      }
    };

    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage }]
      };
    }

    if (req.responseFormat === "json") {
      body.generationConfig.responseMimeType = "application/json";
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Approximate usage
    const promptTokens = approximateTokenCount(JSON.stringify(req.messages));
    const completionTokens = approximateTokenCount(content);

    return {
      content,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || promptTokens,
        completionTokens: data.usageMetadata?.candidatesTokenCount || completionTokens
      }
    };
  }

  countTokens(text: string): number {
    return approximateTokenCount(text);
  }

  estimateCost(usage: TokenUsage, modelInfo: ModelInfo): number {
    return (usage.promptTokens * modelInfo.inputCostPer1M + usage.completionTokens * modelInfo.outputCostPer1M) / 1000000;
  }
}

class OpenRouterAdapter implements LLMProviderAdapter {
  id = "openrouter";

  async complete(req: UnifiedRequest, apiKey?: string): Promise<UnifiedResponse> {
    if (!apiKey) throw new Error("OpenRouter API Key is required.");

    const body: any = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
    };

    if (req.maxTokens) body.max_tokens = req.maxTokens;
    if (req.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://repomind.ai",
        "X-Title": "RepoMind Analyzer"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenRouter API error (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    return {
      content: data.choices[0].message.content || "",
      usage: {
        promptTokens: data.usage?.prompt_tokens || approximateTokenCount(JSON.stringify(req.messages)),
        completionTokens: data.usage?.completion_tokens || approximateTokenCount(data.choices[0].message.content || "")
      }
    };
  }

  countTokens(text: string): number {
    return approximateTokenCount(text);
  }

  estimateCost(usage: TokenUsage, modelInfo: ModelInfo): number {
    return (usage.promptTokens * modelInfo.inputCostPer1M + usage.completionTokens * modelInfo.outputCostPer1M) / 1000000;
  }
}

class OllamaAdapter implements LLMProviderAdapter {
  id = "ollama";

  async complete(req: UnifiedRequest, apiKey?: string): Promise<UnifiedResponse> {
    const body: any = {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
      stream: false
    };

    if (req.maxTokens) body.max_tokens = req.maxTokens;
    if (req.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const endpoint = process.env.OLLAMA_HOST || "http://localhost:11434/v1/chat/completions";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    return {
      content: data.choices[0].message.content || "",
      usage: {
        promptTokens: data.usage?.prompt_tokens || approximateTokenCount(JSON.stringify(req.messages)),
        completionTokens: data.usage?.completion_tokens || approximateTokenCount(data.choices[0].message.content || "")
      }
    };
  }

  countTokens(text: string): number {
    return approximateTokenCount(text);
  }

  estimateCost(usage: TokenUsage, modelInfo: ModelInfo): number {
    return 0; // Local Ollama has no cost
  }
}

// Registry singleton
const adapters: Record<string, LLMProviderAdapter> = {
  openai: new OpenAIAdapter(),
  anthropic: new AnthropicAdapter(),
  google: new GeminiAdapter(),
  openrouter: new OpenRouterAdapter(),
  ollama: new OllamaAdapter()
};

export function getAdapter(providerSlug: string): LLMProviderAdapter {
  const adapter = adapters[providerSlug];
  if (!adapter) {
    throw new Error(`No adapter found for provider: ${providerSlug}`);
  }
  return adapter;
}

// Helper to validate user API Key and return model list
export async function validateApiKey(providerSlug: string, apiKey: string): Promise<boolean> {
  try {
    if (providerSlug === "ollama") return true; // local
    const adapter = getAdapter(providerSlug);
    
    let model = "";
    if (providerSlug === "openai") {
      model = "gpt-4o-mini";
    } else if (providerSlug === "anthropic") {
      model = "claude-3-5-haiku-20241022";
    } else if (providerSlug === "google") {
      model = "gemini-1.5-flash";
    } else if (providerSlug === "openrouter") {
      model = "openai/gpt-4o-mini"; // Use a stable cheap model to test ping
    }

    if (!model) return false;

    const testReq: UnifiedRequest = {
      model,
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 5
    };

    const res = await adapter.complete(testReq, apiKey);
    return res.content.length > 0;
  } catch (error) {
    console.error("API key validation failed:", error);
    return false;
  }
}

// Unified call interface that retrieves the provider API Key from database and executes the call
export async function executeLLMCall(
  userId: string,
  modelDatabaseId: string,
  req: UnifiedRequest,
  analysisId?: string
): Promise<UnifiedResponse> {
  // 1. Fetch model info
  let modelRow = db.prepare(`
    SELECT m.*, p.slug as provider_slug 
    FROM llm_models m 
    JOIN llm_providers p ON m.provider_id = p.id 
    WHERE m.id = ? OR m.model_id = ?
  `).get(modelDatabaseId, modelDatabaseId) as any;

  if (!modelRow) {
    if (modelDatabaseId.startsWith("or-")) {
      const actualModelId = modelDatabaseId.substring(3);
      modelRow = {
        id: modelDatabaseId,
        provider_id: "p4",
        provider_slug: "openrouter",
        model_id: actualModelId,
        display_name: actualModelId,
        context_window: 128000,
        max_output_tokens: 4096,
        input_cost_per_1m: 0,
        output_cost_per_1m: 0,
        supports_vision: 0,
        supports_function_calling: 0
      };
    } else if (modelDatabaseId.startsWith("ollama-")) {
      const actualModelId = modelDatabaseId.substring(7);
      modelRow = {
        id: modelDatabaseId,
        provider_id: "p5",
        provider_slug: "ollama",
        model_id: actualModelId,
        display_name: actualModelId,
        context_window: 8192,
        max_output_tokens: 2048,
        input_cost_per_1m: 0,
        output_cost_per_1m: 0,
        supports_vision: 0,
        supports_function_calling: 0
      };
    } else {
      throw new Error(`Model ${modelDatabaseId} not found in model registry.`);
    }
  }

  // 2. Fetch decrypt key if not local Ollama
  let apiKey: string | undefined = undefined;
  if (modelRow.provider_slug !== "ollama") {
    const keyRow = db.prepare(`
      SELECT encrypted_key, iv FROM user_api_keys 
      WHERE user_id = ? AND provider_id = ?
    `).get(userId, modelRow.provider_id) as any;

    if (!keyRow) {
      throw new Error(`No API key registered for provider: ${modelRow.provider_slug}`);
    }
    apiKey = decrypt(keyRow.encrypted_key, keyRow.iv);
  }

  const adapter = getAdapter(modelRow.provider_slug);
  
  // Update request model to use provider's native model_id
  const updatedReq = { ...req, model: modelRow.model_id };

  const start = Date.now();
  const response = await adapter.complete(updatedReq, apiKey);
  const latency = Date.now() - start;

  // 3. Compute cost and log usage
  const cost = adapter.estimateCost(response.usage, {
    id: modelRow.id,
    providerId: modelRow.provider_id,
    modelId: modelRow.model_id,
    displayName: modelRow.display_name,
    contextWindow: modelRow.context_window,
    maxOutputTokens: modelRow.max_output_tokens,
    inputCostPer1M: modelRow.input_cost_per_1m,
    outputCostPer1M: modelRow.output_cost_per_1m,
    supportsVision: !!modelRow.supports_vision,
    supportsFunctionCalling: !!modelRow.supports_function_calling
  });

  // Log in usage table
  db.prepare(`
    INSERT INTO usage_logs (id, analysis_id, user_id, model_id, prompt_tokens, completion_tokens, cost_usd, latency_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    analysisId || null,
    userId,
    modelRow.id,
    response.usage.promptTokens,
    response.usage.completionTokens,
    cost,
    latency
  );

  // If there's an active analysis, add cost to it
  if (analysisId) {
    db.prepare(`
      UPDATE analyses 
      SET total_cost_usd = total_cost_usd + ? 
      WHERE id = ?
    `).run(cost, analysisId);
  }

  return response;
}
