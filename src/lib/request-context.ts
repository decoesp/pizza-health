import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getEnv } from "@/lib/env";

export async function requestIp(): Promise<string> {
  const list = await headers();
  return (
    list.get("cf-connecting-ip") ||
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    list.get("x-real-ip") ||
    "local"
  );
}

export function hashIp(ip: string): string {
  const env = getEnv();
  const salt = env.RATE_LIMIT_SALT || env.DOCUMENT_ENCRYPTION_KEY || "pizza-health";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function requestIpHash(): Promise<string> {
  return hashIp(await requestIp());
}

export async function requestUserAgent(): Promise<string> {
  const list = await headers();
  return (list.get("user-agent") || "desconhecido").slice(0, 240);
}
