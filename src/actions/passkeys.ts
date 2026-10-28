"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { deletePasskey } from "@/lib/auth/webauthn";
import { recordAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions/types";

export async function deletePasskeyAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/perfil/seguranca");
  const passkeyId = String(formData.get("passkeyId") ?? "");
  if (!passkeyId) return { error: "Passkey não encontrada." };
  const removed = await deletePasskey(user.id, passkeyId);
  if (!removed) return { error: "Passkey não encontrada." };
  await recordAudit({
    actorId: user.id,
    action: "passkey.delete",
    entityType: "webauthn_credential",
    entityId: passkeyId,
  });
  revalidatePath("/perfil/seguranca");
  return { ok: true, message: "Passkey removida." };
}
