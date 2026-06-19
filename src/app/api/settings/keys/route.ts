import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
import { validateApiKey } from "@/lib/llm";
import { encrypt } from "@/lib/crypto";
import crypto from "node:crypto";

export async function GET(req: Request) {
  try {
    const providers = db.prepare("SELECT * FROM llm_providers WHERE slug != 'ollama'").all() as any[];
    const userKeys = db.prepare("SELECT provider_id, last_validated_at, is_valid FROM user_api_keys WHERE user_id = ?").all("default-user") as any[];

    const result = providers.map(p => {
      const userKey = userKeys.find(k => k.provider_id === p.id);
      return {
        id: p.id,
        slug: p.slug,
        displayName: p.display_name,
        baseUrl: p.base_url,
        hasKey: !!userKey,
        isValid: userKey ? !!userKey.is_valid : false,
        lastValidatedAt: userKey ? userKey.last_validated_at : null
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { providerId, apiKey } = await req.json();

    if (!providerId || !apiKey) {
      return NextResponse.json({ error: { message: "providerId and apiKey are required." } }, { status: 400 });
    }

    // Get provider slug
    const provider = db.prepare("SELECT * FROM llm_providers WHERE id = ?").get(providerId) as any;
    if (!provider) {
      return NextResponse.json({ error: { message: "Provider not found." } }, { status: 404 });
    }

    // Clean key (remove whitespaces and leading/trailing quotes)
    const cleanApiKey = apiKey.trim().replace(/^['"]|['"]$/g, "");

    // Validate key
    const isValid = await validateApiKey(provider.slug, cleanApiKey);
    if (!isValid) {
      return NextResponse.json({ error: { message: "Invalid API key. Please check your token and try again." } }, { status: 400 });
    }

    // Encrypt key
    const { iv, encryptedData } = encrypt(cleanApiKey);

    // Save key in database
    const existingKey = db.prepare("SELECT id FROM user_api_keys WHERE user_id = ? AND provider_id = ?")
      .get("default-user", providerId) as { id: string } | undefined;

    if (existingKey) {
      db.prepare(`
        UPDATE user_api_keys 
        SET encrypted_key = ?, iv = ?, last_validated_at = ?, is_valid = 1 
        WHERE id = ?
      `).run(encryptedData, iv, new Date().toISOString(), existingKey.id);
    } else {
      db.prepare(`
        INSERT INTO user_api_keys (id, user_id, provider_id, encrypted_key, iv, last_validated_at, is_valid)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(crypto.randomUUID(), "default-user", providerId, encryptedData, iv, new Date().toISOString());
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get("providerId");

    if (!providerId) {
      return NextResponse.json({ error: { message: "providerId is required." } }, { status: 400 });
    }

    db.prepare("DELETE FROM user_api_keys WHERE user_id = ? AND provider_id = ?")
      .run("default-user", providerId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
