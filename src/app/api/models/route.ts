import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Comprehensive up-to-date static list for standard providers
const STATIC_MODELS = [
  // OpenAI
  { id: "m1", modelId: "gpt-4o", displayName: "GPT-4o", providerId: "p1", providerSlug: "openai", providerName: "OpenAI", contextWindow: 128000, maxOutputTokens: 4096, inputCostPer1M: 2.5, outputCostPer1M: 10.0, supportsVision: true, supportsFunctionCalling: true },
  { id: "m2", modelId: "gpt-4o-mini", displayName: "GPT-4o Mini", providerId: "p1", providerSlug: "openai", providerName: "OpenAI", contextWindow: 128000, maxOutputTokens: 16384, inputCostPer1M: 0.150, outputCostPer1M: 0.600, supportsVision: true, supportsFunctionCalling: true },
  { id: "m-o1", modelId: "o1", displayName: "o1 Reasoning", providerId: "p1", providerSlug: "openai", providerName: "OpenAI", contextWindow: 200000, maxOutputTokens: 32768, inputCostPer1M: 15.0, outputCostPer1M: 60.0, supportsVision: true, supportsFunctionCalling: true },
  { id: "m-o1-mini", modelId: "o1-mini", displayName: "o1-mini Reasoning", providerId: "p1", providerSlug: "openai", providerName: "OpenAI", contextWindow: 128000, maxOutputTokens: 65536, inputCostPer1M: 3.0, outputCostPer1M: 12.0, supportsVision: false, supportsFunctionCalling: true },
  { id: "m-o3-mini", modelId: "o3-mini", displayName: "o3-mini Reasoning", providerId: "p1", providerSlug: "openai", providerName: "OpenAI", contextWindow: 200000, maxOutputTokens: 100000, inputCostPer1M: 1.1, outputCostPer1M: 4.4, supportsVision: false, supportsFunctionCalling: true },

  // Anthropic
  { id: "m3", modelId: "claude-3-5-sonnet-20241022", displayName: "Claude 3.5 Sonnet", providerId: "p2", providerSlug: "anthropic", providerName: "Anthropic", contextWindow: 200000, maxOutputTokens: 8192, inputCostPer1M: 3.0, outputCostPer1M: 15.0, supportsVision: true, supportsFunctionCalling: true },
  { id: "m4", modelId: "claude-3-5-haiku-20241022", displayName: "Claude 3.5 Haiku", providerId: "p2", providerSlug: "anthropic", providerName: "Anthropic", contextWindow: 200000, maxOutputTokens: 4096, inputCostPer1M: 0.8, outputCostPer1M: 4.0, supportsVision: false, supportsFunctionCalling: true },
  { id: "m-opus", modelId: "claude-3-opus-20240229", displayName: "Claude 3 Opus", providerId: "p2", providerSlug: "anthropic", providerName: "Anthropic", contextWindow: 200000, maxOutputTokens: 4096, inputCostPer1M: 15.0, outputCostPer1M: 75.0, supportsVision: true, supportsFunctionCalling: true },

  // Google Gemini
  { id: "m5", modelId: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro", providerId: "p3", providerSlug: "google", providerName: "Google Gemini", contextWindow: 2000000, maxOutputTokens: 8192, inputCostPer1M: 1.25, outputCostPer1M: 5.0, supportsVision: true, supportsFunctionCalling: true },
  { id: "m6", modelId: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash", providerId: "p3", providerSlug: "google", providerName: "Google Gemini", contextWindow: 1000000, maxOutputTokens: 8192, inputCostPer1M: 0.075, outputCostPer1M: 0.3, supportsVision: true, supportsFunctionCalling: true },
  { id: "m7", modelId: "gemini-2.0-flash-exp", displayName: "Gemini 2.0 Flash Exp", providerId: "p3", providerSlug: "google", providerName: "Google Gemini", contextWindow: 1000000, maxOutputTokens: 8192, inputCostPer1M: 0.0, outputCostPer1M: 0.0, supportsVision: true, supportsFunctionCalling: true },
  { id: "m-gem-2.0-flash", modelId: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", providerId: "p3", providerSlug: "google", providerName: "Google Gemini", contextWindow: 1048576, maxOutputTokens: 8192, inputCostPer1M: 0.075, outputCostPer1M: 0.3, supportsVision: true, supportsFunctionCalling: true }
];

export async function GET(req: Request) {
  try {
    const finalModels: any[] = [...STATIC_MODELS];

    // 1. Dynamically fetch OpenRouter models
    try {
      const orRes = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(3000) });
      if (orRes.ok) {
        const orData = await orRes.json();
        if (orData?.data && Array.isArray(orData.data)) {
          const dynamicOrModels = orData.data.map((m: any) => ({
            id: `or-${m.id}`,
            modelId: m.id,
            displayName: `${m.name} (${Math.round(m.context_length / 1000)}k)`,
            providerId: "p4",
            providerSlug: "openrouter",
            providerName: "OpenRouter",
            contextWindow: m.context_length,
            maxOutputTokens: m.top_provider?.max_completion_tokens || 4096,
            inputCostPer1M: parseFloat(m.pricing.prompt) * 1000000,
            outputCostPer1M: parseFloat(m.pricing.completion) * 1000000,
            supportsVision: m.architecture?.modality?.includes("image") ? true : false,
            supportsFunctionCalling: m.supported_parameters?.includes("tools") ? true : false
          }));

          // Merge OpenRouter models: append them to final array
          finalModels.push(...dynamicOrModels);
        }
      }
    } catch (e) {
      console.warn("Could not dynamically fetch OpenRouter models, using fallbacks:", e);
      // Fallback OpenRouter models
      finalModels.push(
        { id: "m8", modelId: "meta-llama/llama-3.1-70b-instruct", displayName: "Llama 3.1 70B (OpenRouter)", providerId: "p4", providerSlug: "openrouter", providerName: "OpenRouter", contextWindow: 131072, maxOutputTokens: 4096, inputCostPer1M: 0.52, outputCostPer1M: 0.75, supportsVision: false, supportsFunctionCalling: false },
        { id: "m9", modelId: "anthropic/claude-3.5-sonnet", displayName: "Claude 3.5 Sonnet (OpenRouter)", providerId: "p4", providerSlug: "openrouter", providerName: "OpenRouter", contextWindow: 200000, maxOutputTokens: 8192, inputCostPer1M: 3.0, outputCostPer1M: 15.0, supportsVision: true, supportsFunctionCalling: true },
        { id: "m10", modelId: "google/gemini-flash-1.5", displayName: "Gemini 1.5 Flash (OpenRouter)", providerId: "p4", providerSlug: "openrouter", providerName: "OpenRouter", contextWindow: 280000, maxOutputTokens: 8192, inputCostPer1M: 0.075, outputCostPer1M: 0.3, supportsVision: true, supportsFunctionCalling: true }
      );
    }

    // 2. Dynamically fetch Ollama tags (Localhost)
    try {
      const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
      const ollamaRes = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (ollamaRes.ok) {
        const ollamaData = await ollamaRes.json();
        if (ollamaData?.models && Array.isArray(ollamaData.models)) {
          const dynamicOllamaModels = ollamaData.models.map((m: any) => ({
            id: `ollama-${m.name}`,
            modelId: m.name,
            displayName: `${m.name} (Local)`,
            providerId: "p5",
            providerSlug: "ollama",
            providerName: "Ollama (Local)",
            contextWindow: 8192,
            maxOutputTokens: 2048,
            inputCostPer1M: 0.0,
            outputCostPer1M: 0.0,
            supportsVision: false,
            supportsFunctionCalling: false
          }));

          finalModels.push(...dynamicOllamaModels);
        }
      }
    } catch (e) {
      // Ollama not running or timeout: append fallback local models
      finalModels.push(
        { id: "m11", modelId: "llama3", displayName: "Llama 3 (Local Fallback)", providerId: "p5", providerSlug: "ollama", providerName: "Ollama (Local)", contextWindow: 8192, maxOutputTokens: 2048, inputCostPer1M: 0.0, outputCostPer1M: 0.0, supportsVision: false, supportsFunctionCalling: false },
        { id: "m12", modelId: "mistral", displayName: "Mistral (Local Fallback)", providerId: "p5", providerSlug: "ollama", providerName: "Ollama (Local)", contextWindow: 8192, maxOutputTokens: 2048, inputCostPer1M: 0.0, outputCostPer1M: 0.0, supportsVision: false, supportsFunctionCalling: false }
      );
    }

    return NextResponse.json({ models: finalModels });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
