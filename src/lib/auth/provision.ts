import "server-only";
import { execute, newId, nowIso, queryOne, withTransaction } from "@/lib/db";
import { ensureDefaultHabits } from "@/lib/data/habits";
import { uniqueCommunitySlug } from "@/lib/domain/slug";
import { notify } from "@/lib/notifications";

const COLORS = ["#C2410C", "#3F6B4F", "#8A5A0F", "#4C6FA8", "#8A5A8F"];

export type ProvisionInput = {
  name: string;
  email: string;
  passwordHash: string;
  ranking?: boolean;
  role?: "user" | "admin";
};

/**
 * Cria a conta, a comunidade pessoal, as preferências de compartilhamento e os
 * hábitos padrão. Usado pelo cadastro por senha e pelo primeiro login OIDC.
 * Se o e-mail já existir, devolve a conta existente sem sobrescrever nada.
 */
export async function provisionUser(
  input: ProvisionInput,
): Promise<{ userId: string; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  if (existing) {
    return { userId: String(existing.id), created: false };
  }

  const userId = newId("usr");
  const now = nowIso();
  const color = COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#C2410C";
  const communityId = newId("com");
  const firstName = input.name.split(/\s+/)[0] || input.name;
  const slug = await uniqueCommunitySlug(`cuidado-${input.name}`);

  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO users (id, email, name, password_hash, role, avatar_color, privacy_rank, privacy_profile,
        notify_comments, notify_reactions, notify_challenges, notify_reminders, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        userId,
        email,
        input.name,
        input.passwordHash,
        input.role ?? "user",
        color,
        input.ranking ? 1 : 0,
        1,
        1,
        1,
        1,
        1,
        now,
        now,
      ],
    );
    for (const kind of ["terms", "privacy", "health_data"] as const) {
      await tx.execute(
        "INSERT INTO legal_acceptances (id, user_id, kind, version, accepted_at) VALUES (?,?,?,?,?)",
        [newId("leg"), userId, kind, "2026-10", now],
      );
    }
    await tx.execute(
      `INSERT INTO communities (id, slug, name, description, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [
        communityId,
        slug,
        `Cuidado de ${firstName}`,
        "Um espaço privado para começar. Convide pessoas de confiança quando quiser.",
        userId,
        now,
        now,
      ],
    );
    await tx.execute(
      "INSERT INTO community_members (id, community_id, user_id, role, joined_at) VALUES (?,?,?,?,?)",
      [newId("mem"), communityId, userId, "owner", now],
    );
    for (const category of ["profile", "habits", "vaccines", "exams"]) {
      await tx.execute(
        "INSERT INTO sharing_preferences (id, user_id, community_id, category, shared, updated_at) VALUES (?,?,?,?,?,?)",
        [newId("shr"), userId, communityId, category, category === "profile" ? 1 : 0, now],
      );
    }
  });

  await ensureDefaultHabits(userId);
  await notify({
    userId,
    kind: "system",
    title: "Bem-vindo ao Pizza Health",
    body: "Seu espaço está pronto. Comece registrando um hábito ou convidando sua turma.",
    href: "/inicio",
  });

  return { userId, created: true };
}

export async function touchLastLogin(userId: string): Promise<void> {
  const now = nowIso();
  await execute("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?", [
    now,
    now,
    userId,
  ]);
}
