"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { execute } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import type { ActionState } from "@/lib/actions/types";

export async function markAllNotificationsReadAction(_formData: FormData): Promise<void> {
  void _formData;
  const user = await requireUser("/notificacoes");
  await execute("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", [
    new Date().toISOString(),
    user.id,
  ]);
  revalidatePath("/notificacoes");
  revalidatePath("/inicio");
}

export async function markNotificationReadAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/notificacoes");
  const id = String(formData.get("notificationId") ?? "");
  await execute("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?", [
    new Date().toISOString(),
    id,
    user.id,
  ]);
  revalidatePath("/notificacoes");
  return { ok: true, message: "Notificação marcada como lida." };
}
