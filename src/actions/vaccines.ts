"use server";

import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { execute, newId, nowIso, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { evaluateAchievements } from "@/lib/data/points";
import { recordAudit } from "@/lib/audit";
import { todayIso } from "@/lib/domain/dates";
import type { ActionState } from "@/lib/actions/types";

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data válida.");

export async function addVaccineAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/vacinas");
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Informe o nome da vacina.").max(120),
      manufacturer: z.string().trim().max(120).optional(),
      doseLabel: z.string().trim().max(60).optional(),
      appliedOn: dateSchema,
      location: z.string().trim().max(160).optional(),
      documentId: z.string().optional(),
      notes: z.string().trim().max(500).optional(),
      confirm: z.string().optional(),
    })
    .safeParse({
      name: formData.get("name"),
      manufacturer: formData.get("manufacturer") || undefined,
      doseLabel: formData.get("doseLabel") || undefined,
      appliedOn: formData.get("appliedOn"),
      location: formData.get("location") || undefined,
      documentId: formData.get("documentId") || undefined,
      notes: formData.get("notes") || undefined,
      confirm: formData.get("confirm") || undefined,
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (parsed.data.appliedOn > todayIso()) {
    return { error: "A data de aplicação não pode estar no futuro." };
  }

  let documentId: string | null = null;
  if (parsed.data.documentId) {
    const doc = await queryOne<{ id: string }>(
      "SELECT id FROM health_documents WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1",
      [parsed.data.documentId, user.id],
    );
    if (!doc) return { error: "Comprovante não encontrado." };
    documentId = String(doc.id);
  }

  const now = nowIso();
  await execute(
    `INSERT INTO vaccine_records (id, user_id, document_id, name, manufacturer, dose_label, applied_on, location, status, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId("vac"),
      user.id,
      documentId,
      parsed.data.name,
      parsed.data.manufacturer ?? null,
      parsed.data.doseLabel ?? null,
      parsed.data.appliedOn,
      parsed.data.location ?? null,
      parsed.data.confirm ? "confirmed" : "pending",
      parsed.data.notes ?? null,
      now,
      now,
    ],
  );
  await evaluateAchievements(user.id);
  await recordAudit({
    actorId: user.id,
    action: "vaccine.create",
    entityType: "vaccine_record",
    metadata: { hasDocument: Boolean(documentId) },
  });
  revalidatePath("/vacinas");
  revalidatePath("/inicio");
  return {
    ok: true,
    message: parsed.data.confirm
      ? "Vacina registrada e conferida."
      : "Vacina registrada. Confira os dados e marque como confirmada quando tiver o comprovante.",
  };
}

export async function confirmVaccineAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/vacinas");
  const vaccineId = String(formData.get("vaccineId") ?? "");
  const vaccine = await queryOne<{ id: string }>(
    "SELECT id FROM vaccine_records WHERE id = ? AND user_id = ? LIMIT 1",
    [vaccineId, user.id],
  );
  if (!vaccine) return { error: "Registro não encontrado." };
  await execute(
    "UPDATE vaccine_records SET status = 'confirmed', updated_at = ? WHERE id = ? AND user_id = ?",
    [nowIso(), vaccineId, user.id],
  );
  await evaluateAchievements(user.id);
  await recordAudit({
    actorId: user.id,
    action: "vaccine.confirm",
    entityType: "vaccine_record",
    entityId: vaccineId,
  });
  revalidatePath("/vacinas");
  return { ok: true, message: "Registro confirmado." };
}

export async function deleteVaccineAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/vacinas");
  const vaccineId = String(formData.get("vaccineId") ?? "");
  const removed = await execute("DELETE FROM vaccine_records WHERE id = ? AND user_id = ?", [
    vaccineId,
    user.id,
  ]);
  if (removed.rowsAffected === 0) return { error: "Registro não encontrado." };
  await recordAudit({
    actorId: user.id,
    action: "vaccine.delete",
    entityType: "vaccine_record",
    entityId: vaccineId,
  });
  revalidatePath("/vacinas");
  return { ok: true, message: "Registro removido." };
}
