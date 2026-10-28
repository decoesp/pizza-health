"use server";

import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { execute, newId, nowIso, queryOne, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { membershipFor } from "@/lib/authz";
import { getEnv } from "@/lib/env";
import {
  encryptBytes,
  safeFileName,
  sha256Hex,
  validateUpload,
} from "@/lib/crypto/documents";
import { evaluateAchievements } from "@/lib/data/points";
import { getCommunityById } from "@/lib/data/communities";
import { recordAudit } from "@/lib/audit";
import { todayIso } from "@/lib/domain/dates";
import type { ActionState } from "@/lib/actions/types";

const dateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data válida.")
  .optional();

async function documentOwner(userId: string, documentId: string) {
  return queryOne<{ id: string; user_id: string; title: string }>(
    "SELECT id, user_id, title FROM health_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [documentId],
  );
}

async function examOwner(userId: string, examId: string) {
  return queryOne<{ id: string; user_id: string; document_id: string | null }>(
    "SELECT id, user_id, document_id FROM laboratory_exams WHERE id = ? AND user_id = ? LIMIT 1",
    [examId, userId],
  );
}

export async function uploadDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/exames/enviar");
  const env = getEnv();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo." };
  }
  if (file.size > env.MAX_UPLOAD_BYTES) {
    return { error: "O arquivo excede o limite de 8 MB." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateUpload(bytes, file.name);
  if (!validation.ok) return { error: validation.error };

  const parsed = z
    .object({
      title: z.string().trim().min(2, "Dê um título ao documento.").max(120),
      category: z.enum(["exam", "vaccine", "other"]),
      labName: z.string().trim().max(120).optional(),
      collectedOn: dateField,
      resultedOn: dateField,
      notes: z.string().trim().max(1000).optional(),
      shareCommunityId: z.string().optional(),
    })
    .safeParse({
      title: formData.get("title"),
      category: formData.get("category") ?? "exam",
      labName: formData.get("labName") || undefined,
      collectedOn: formData.get("collectedOn") || undefined,
      resultedOn: formData.get("resultedOn") || undefined,
      notes: formData.get("notes") || undefined,
      shareCommunityId: formData.get("shareCommunityId") || undefined,
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const today = todayIso();
  if (parsed.data.collectedOn && parsed.data.collectedOn > today) {
    return { error: "A data de coleta não pode estar no futuro." };
  }
  if (parsed.data.resultedOn && parsed.data.resultedOn > today) {
    return { error: "A data do resultado não pode estar no futuro." };
  }

  const sha256 = sha256Hex(bytes);
  const duplicate = await queryOne<{ id: string; title: string }>(
    "SELECT id, title FROM health_documents WHERE user_id = ? AND sha256 = ? AND deleted_at IS NULL LIMIT 1",
    [user.id, sha256],
  );
  if (duplicate) {
    return { error: `Este arquivo já está na sua central como “${duplicate.title}”.` };
  }

  const encrypted = encryptBytes(bytes);
  const documentId = newId("doc");
  const now = nowIso();
  const fileName = safeFileName(file.name);
  const category = parsed.data.category;
  const status = category === "exam" ? "awaiting_review" : "received";

  let sharedCommunitySlug = "";
  if (parsed.data.shareCommunityId) {
    const membership = await membershipFor(user.id, parsed.data.shareCommunityId);
    if (!membership) return { error: "Você não participa da comunidade escolhida." };
    const community = await getCommunityById(parsed.data.shareCommunityId);
    sharedCommunitySlug = community?.slug ?? "";
  }

  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO health_documents (id, user_id, title, category, file_name, mime_type, size_bytes, sha256,
        status, lab_name, collected_on, resulted_on, notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        documentId,
        user.id,
        parsed.data.title,
        category,
        fileName,
        validation.file.mimeType,
        file.size,
        sha256,
        status,
        parsed.data.labName ?? null,
        parsed.data.collectedOn ?? null,
        parsed.data.resultedOn ?? null,
        parsed.data.notes ?? null,
        now,
        now,
      ],
    );
    await tx.execute(
      "INSERT INTO document_blobs (document_id, data, iv, tag, version) VALUES (?,?,?,?,?)",
      [documentId, encrypted.data, encrypted.iv, encrypted.tag, encrypted.version],
    );
    if (parsed.data.shareCommunityId) {
      await tx.execute(
        "INSERT INTO document_shares (id, document_id, community_id, shared_by, created_at) VALUES (?,?,?,?,?)",
        [newId("dsh"), documentId, parsed.data.shareCommunityId, user.id, now],
      );
    }
    if (category === "exam") {
      await tx.execute(
        `INSERT INTO laboratory_exams (id, document_id, user_id, lab_name, collected_on, resulted_on, notes, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          newId("lex"),
          documentId,
          user.id,
          parsed.data.labName ?? null,
          parsed.data.collectedOn ?? null,
          parsed.data.resultedOn ?? null,
          parsed.data.notes ?? null,
          "awaiting_review",
          now,
          now,
        ],
      );
    }
  });

  await evaluateAchievements(user.id);
  await recordAudit({
    actorId: user.id,
    action: "document.upload",
    entityType: "health_document",
    entityId: documentId,
    communityId: parsed.data.shareCommunityId ?? null,
    metadata: {
      category,
      sizeBytes: file.size,
      mimeType: validation.file.mimeType,
    },
  });
  revalidatePath("/exames");
  revalidatePath("/inicio");
  if (sharedCommunitySlug) revalidatePath(`/comunidade/${sharedCommunitySlug}`);
  redirect(`/exames/${documentId}`);
}

export async function updateDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/exames");
  const documentId = String(formData.get("documentId") ?? "");
  const doc = await documentOwner(user.id, documentId);
  if (!doc || doc.user_id !== user.id) return { error: "Documento não encontrado." };
  const parsed = z
    .object({
      title: z.string().trim().min(2).max(120),
      labName: z.string().trim().max(120).optional(),
      collectedOn: dateField,
      resultedOn: dateField,
      notes: z.string().trim().max(1000).optional(),
      status: z.enum(["received", "processing", "awaiting_review", "confirmed", "failed"]),
    })
    .safeParse({
      title: formData.get("title"),
      labName: formData.get("labName") || undefined,
      collectedOn: formData.get("collectedOn") || undefined,
      resultedOn: formData.get("resultedOn") || undefined,
      notes: formData.get("notes") || undefined,
      status: formData.get("status") ?? "received",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  await execute(
    "UPDATE health_documents SET title = ?, lab_name = ?, collected_on = ?, resulted_on = ?, notes = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [
      parsed.data.title,
      parsed.data.labName ?? null,
      parsed.data.collectedOn ?? null,
      parsed.data.resultedOn ?? null,
      parsed.data.notes ?? null,
      parsed.data.status,
      nowIso(),
      documentId,
      user.id,
    ],
  );
  await recordAudit({
    actorId: user.id,
    action: "document.update",
    entityType: "health_document",
    entityId: documentId,
  });
  revalidatePath(`/exames/${documentId}`);
  revalidatePath("/exames");
  return { ok: true, message: "Metadados atualizados." };
}

export async function deleteDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/exames");
  const documentId = String(formData.get("documentId") ?? "");
  const doc = await documentOwner(user.id, documentId);
  if (!doc || doc.user_id !== user.id) return { error: "Documento não encontrado." };
  await withTransaction(async (tx) => {
    await tx.execute("UPDATE laboratory_exams SET document_id = NULL WHERE document_id = ?", [documentId]);
    await tx.execute("UPDATE vaccine_records SET document_id = NULL WHERE document_id = ?", [documentId]);
    await tx.execute("DELETE FROM document_shares WHERE document_id = ?", [documentId]);
    await tx.execute("DELETE FROM document_blobs WHERE document_id = ?", [documentId]);
    await tx.execute("DELETE FROM health_documents WHERE id = ? AND user_id = ?", [documentId, user.id]);
  });
  await recordAudit({
    actorId: user.id,
    action: "document.delete",
    entityType: "health_document",
    entityId: documentId,
  });
  revalidatePath("/exames");
  revalidatePath("/inicio");
  redirect("/exames?removido=1");
}

export async function shareDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/exames");
  const documentId = String(formData.get("documentId") ?? "");
  const communityId = String(formData.get("communityId") ?? "");
  const doc = await documentOwner(user.id, documentId);
  if (!doc || doc.user_id !== user.id) return { error: "Documento não encontrado." };
  const membership = await membershipFor(user.id, communityId);
  if (!membership) return { error: "Você não participa desta comunidade." };
  await execute(
    "INSERT INTO document_shares (id, document_id, community_id, shared_by, created_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING",
    [newId("dsh"), documentId, communityId, user.id, nowIso()],
  );
  const community = await getCommunityById(communityId);
  await recordAudit({
    actorId: user.id,
    action: "document.share",
    entityType: "document_share",
    entityId: documentId,
    communityId,
  });
  revalidatePath(`/exames/${documentId}`);
  revalidatePath(`/comunidade/${community?.slug ?? ""}`);
  return { ok: true, message: "Documento compartilhado com a comunidade." };
}

export async function unshareDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/exames");
  const documentId = String(formData.get("documentId") ?? "");
  const communityId = String(formData.get("communityId") ?? "");
  const doc = await documentOwner(user.id, documentId);
  if (!doc || doc.user_id !== user.id) return { error: "Documento não encontrado." };
  await execute(
    "DELETE FROM document_shares WHERE document_id = ? AND community_id = ?",
    [documentId, communityId],
  );
  await recordAudit({
    actorId: user.id,
    action: "document.unshare",
    entityType: "document_share",
    entityId: documentId,
    communityId,
  });
  revalidatePath(`/exames/${documentId}`);
  return { ok: true, message: "Compartilhamento revogado." };
}

export async function createExamAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/exames");
  const parsed = z
    .object({
      labName: z.string().trim().max(120).optional(),
      collectedOn: dateField,
      resultedOn: dateField,
      notes: z.string().trim().max(1000).optional(),
    })
    .safeParse({
      labName: formData.get("labName") || undefined,
      collectedOn: formData.get("collectedOn") || undefined,
      resultedOn: formData.get("resultedOn") || undefined,
      notes: formData.get("notes") || undefined,
    });
  if (!parsed.success) return { error: "Confira as datas informadas." };
  const examId = newId("lex");
  const now = nowIso();
  await execute(
    `INSERT INTO laboratory_exams (id, document_id, user_id, lab_name, collected_on, resulted_on, notes, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      examId,
      null,
      user.id,
      parsed.data.labName ?? null,
      parsed.data.collectedOn ?? null,
      parsed.data.resultedOn ?? null,
      parsed.data.notes ?? null,
      "draft",
      now,
      now,
    ],
  );
  await recordAudit({
    actorId: user.id,
    action: "exam.create",
    entityType: "laboratory_exam",
    entityId: examId,
  });
  revalidatePath("/exames");
  return { ok: true, message: "Exame criado.", link: `/exames/exame/${examId}`, linkLabel: "Abrir exame" };
}

export async function addExamResultAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/exames");
  const examId = String(formData.get("examId") ?? "");
  const exam = await examOwner(user.id, examId);
  if (!exam) return { error: "Exame não encontrado." };
  const parsed = z
    .object({
      name: z.string().trim().min(1, "Informe o nome do indicador.").max(120),
      valueText: z.string().trim().min(1, "Informe o valor.").max(60),
      valueNumeric: z.string().trim().optional(),
      unit: z.string().trim().max(24).optional(),
      reference: z.string().trim().max(120).optional(),
      pageRef: z.string().trim().max(60).optional(),
    })
    .safeParse({
      name: formData.get("name"),
      valueText: formData.get("valueText"),
      valueNumeric: formData.get("valueNumeric") || undefined,
      unit: formData.get("unit") || undefined,
      reference: formData.get("reference") || undefined,
      pageRef: formData.get("pageRef") || undefined,
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  let numeric: number | null = null;
  if (parsed.data.valueNumeric) {
    const value = Number(parsed.data.valueNumeric.replace(",", "."));
    if (!Number.isFinite(value)) return { error: "Valor numérico inválido." };
    numeric = value;
  }
  await execute(
    `INSERT INTO exam_results (id, exam_id, user_id, name, value_text, value_numeric, unit, reference_range, flag, page_ref, extraction_method, validation_status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      newId("res"),
      examId,
      user.id,
      parsed.data.name,
      parsed.data.valueText,
      numeric,
      parsed.data.unit ?? null,
      parsed.data.reference ?? null,
      null,
      parsed.data.pageRef ?? null,
      "manual",
      "pending",
      nowIso(),
      nowIso(),
    ],
  );
  await execute("UPDATE laboratory_exams SET status = 'awaiting_review', updated_at = ? WHERE id = ?", [
    nowIso(),
    examId,
  ]);
  await recordAudit({
    actorId: user.id,
    action: "exam.result_create",
    entityType: "laboratory_exam",
    entityId: examId,
    metadata: { method: "manual" },
  });
  revalidatePath(`/exames/exame/${examId}`);
  return { ok: true, message: "Resultado adicionado. Confirme após revisar." };
}

export async function reviewExamResultAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/exames");
  const resultId = String(formData.get("resultId") ?? "");
  const decision = formData.get("decision") === "confirmed" ? "confirmed" : "rejected";
  const result = await queryOne<{ id: string; exam_id: string; user_id: string }>(
    "SELECT id, exam_id, user_id FROM exam_results WHERE id = ? AND user_id = ? LIMIT 1",
    [resultId, user.id],
  );
  if (!result) return { error: "Resultado não encontrado." };
  await execute(
    "UPDATE exam_results SET validation_status = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [decision, nowIso(), resultId, user.id],
  );
  const pending = await queryOne<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM exam_results WHERE exam_id = ? AND validation_status = 'pending'",
    [String(result.exam_id)],
  );
  const confirmed = await queryOne<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM exam_results WHERE exam_id = ? AND validation_status = 'confirmed'",
    [String(result.exam_id)],
  );
  const examStatus =
    Number(pending?.total ?? 0) === 0 && Number(confirmed?.total ?? 0) > 0
      ? "confirmed"
      : "awaiting_review";
  await execute("UPDATE laboratory_exams SET status = ?, updated_at = ? WHERE id = ?", [
    examStatus,
    nowIso(),
    String(result.exam_id),
  ]);
  if (examStatus === "confirmed") {
    const exam = await queryOne<{ document_id: string | null }>(
      "SELECT document_id FROM laboratory_exams WHERE id = ? LIMIT 1",
      [String(result.exam_id)],
    );
    if (exam?.document_id) {
      await execute("UPDATE health_documents SET status = 'confirmed', updated_at = ? WHERE id = ?", [
        nowIso(),
        String(exam.document_id),
      ]);
    }
  }
  await recordAudit({
    actorId: user.id,
    action: "exam.result_review",
    entityType: "exam_result",
    entityId: resultId,
    metadata: { decision },
  });
  revalidatePath(`/exames/exame/${String(result.exam_id)}`);
  return { ok: true, message: decision === "confirmed" ? "Resultado confirmado." : "Resultado rejeitado." };
}

export async function deleteExamResultAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/exames");
  const resultId = String(formData.get("resultId") ?? "");
  const result = await queryOne<{ id: string; exam_id: string }>(
    "SELECT id, exam_id FROM exam_results WHERE id = ? AND user_id = ? LIMIT 1",
    [resultId, user.id],
  );
  if (!result) return { error: "Resultado não encontrado." };
  await execute("DELETE FROM exam_results WHERE id = ? AND user_id = ?", [resultId, user.id]);
  revalidatePath(`/exames/exame/${String(result.exam_id)}`);
  return { ok: true, message: "Resultado removido." };
}

export async function updateExamMetaAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/exames");
  const examId = String(formData.get("examId") ?? "");
  const exam = await examOwner(user.id, examId);
  if (!exam) return { error: "Exame não encontrado." };
  const parsed = z
    .object({
      labName: z.string().trim().max(120).optional(),
      collectedOn: dateField,
      resultedOn: dateField,
      notes: z.string().trim().max(1000).optional(),
    })
    .safeParse({
      labName: formData.get("labName") || undefined,
      collectedOn: formData.get("collectedOn") || undefined,
      resultedOn: formData.get("resultedOn") || undefined,
      notes: formData.get("notes") || undefined,
    });
  if (!parsed.success) return { error: "Confira as datas." };
  await execute(
    "UPDATE laboratory_exams SET lab_name = ?, collected_on = ?, resulted_on = ?, notes = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [
      parsed.data.labName ?? null,
      parsed.data.collectedOn ?? null,
      parsed.data.resultedOn ?? null,
      parsed.data.notes ?? null,
      nowIso(),
      examId,
      user.id,
    ],
  );
  revalidatePath(`/exames/exame/${examId}`);
  return { ok: true, message: "Exame atualizado." };
}
