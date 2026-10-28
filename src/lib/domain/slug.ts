import { queryOne } from "@/lib/db";
import { generateToken } from "@/lib/auth/password";

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function uniqueCommunitySlug(base: string): Promise<string> {
  const root = slugify(base) || "comunidade";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = generateToken().slice(0, 6).toLowerCase();
    const candidate = `${root}-${suffix}`;
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM communities WHERE slug = ? LIMIT 1",
      [candidate],
    );
    if (!existing) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
