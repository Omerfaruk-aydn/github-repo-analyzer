import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env");

function getOrGenerateKey(): Buffer {
  let keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex && fs.existsSync(ENV_PATH)) {
    const envContent = fs.readFileSync(ENV_PATH, "utf8");
    const match = envContent.match(/^ENCRYPTION_KEY=(.+)$/m);
    if (match) {
      keyHex = match[1].trim();
    }
  }

  if (!keyHex) {
    const newKey = crypto.randomBytes(32).toString("hex");
    const envLine = `\nENCRYPTION_KEY=${newKey}\n`;
    fs.appendFileSync(ENV_PATH, envLine, "utf8");
    keyHex = newKey;
    process.env.ENCRYPTION_KEY = newKey;
  }

  return Buffer.from(keyHex, "hex");
}

export function encrypt(text: string): { iv: string; encryptedData: string } {
  const key = getOrGenerateKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  
  return {
    iv: iv.toString("hex"),
    encryptedData: `${encrypted}:${authTag}`,
  };
}

export function decrypt(encryptedData: string, ivHex: string): string {
  const key = getOrGenerateKey();
  const iv = Buffer.from(ivHex, "hex");
  const parts = encryptedData.split(":");
  const encryptedText = parts[0];
  const authTag = Buffer.from(parts[1], "hex");
  
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}
