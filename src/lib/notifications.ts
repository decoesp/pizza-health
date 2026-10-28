import "server-only";
import { execute, newId, nowIso } from "@/lib/db";

export type NotificationInput = {
  userId: string;
  actorId?: string | null;
  kind:
    | "comment"
    | "reaction"
    | "community"
    | "challenge"
    | "document"
    | "achievement"
    | "system";
  title: string;
  body?: string;
  href?: string | null;
};

/**
 * Notificação interna e genérica: nunca carrega valores de exames, diagnósticos
 * ou nomes de arquivos clínicos no título/corpo.
 */
export async function notify(input: NotificationInput): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return;
  try {
    await execute(
      "INSERT INTO notifications (id, user_id, actor_id, kind, title, body, href, read_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [
        newId("ntf"),
        input.userId,
        input.actorId ?? null,
        input.kind,
        input.title,
        input.body ?? "",
        input.href ?? null,
        null,
        nowIso(),
      ],
    );
  } catch (error) {
    console.error(
      "[notify] falha ao criar notificação",
      error instanceof Error ? error.message : "erro desconhecido",
    );
  }
}
