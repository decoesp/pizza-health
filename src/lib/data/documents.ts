import "server-only";
import { query, queryOne } from "@/lib/db";

export type DocumentStatus =
  | "received"
  | "processing"
  | "awaiting_review"
  | "confirmed"
  | "failed";

export type DocumentCategory = "exam" | "vaccine" | "other";

export type DocumentSummary = {
  id: string;
  title: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  sha256: string;
  labName: string | null;
  collectedOn: string | null;
  resultedOn: string | null;
  createdAt: string;
  shareCount: number;
  examId: string | null;
};

export type DocumentDetail = DocumentSummary & {
  userId: string;
  notes: string | null;
  updatedAt: string;
};

export type DocumentShare = {
  communityId: string;
  communityName: string;
  communitySlug: string;
  createdAt: string;
};

export type LabExam = {
  id: string;
  documentId: string | null;
  labName: string | null;
  collectedOn: string | null;
  resultedOn: string | null;
  notes: string | null;
  status: "draft" | "awaiting_review" | "confirmed";
  createdAt: string;
  resultCount: number;
};

export type ExamResult = {
  id: string;
  examId: string;
  name: string;
  valueText: string;
  valueNumeric: number | null;
  unit: string | null;
  referenceRange: string | null;
  flag: string | null;
  pageRef: string | null;
  extractionMethod: string;
  validationStatus: "pending" | "confirmed" | "rejected";
  createdAt: string;
};

export type VaccineRecord = {
  id: string;
  name: string;
  manufacturer: string | null;
  doseLabel: string | null;
  appliedOn: string;
  location: string | null;
  status: "pending" | "confirmed";
  documentId: string | null;
  notes: string | null;
  createdAt: string;
};

function mapDocument(row: Record<string, unknown>): DocumentSummary {
  return {
    id: String(row.id),
    title: String(row.title),
    category: (row.category as DocumentCategory) ?? "other",
    fileName: String(row.file_name),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes ?? 0),
    status: (row.status as DocumentStatus) ?? "received",
    sha256: String(row.sha256),
    labName: row.lab_name ? String(row.lab_name) : null,
    collectedOn: row.collected_on ? String(row.collected_on) : null,
    resultedOn: row.resulted_on ? String(row.resulted_on) : null,
    createdAt: String(row.created_at),
    shareCount: Number(row.share_count ?? 0),
    examId: row.exam_id ? String(row.exam_id) : null,
  };
}

export async function listDocuments(
  userId: string,
  filters: { category?: DocumentCategory; query?: string } = {},
): Promise<DocumentSummary[]> {
  const conditions = ["d.user_id = ?", "d.deleted_at IS NULL"];
  const params: (string | number | null)[] = [userId];
  if (filters.category) {
    conditions.push("d.category = ?");
    params.push(filters.category);
  }
  if (filters.query?.trim()) {
    conditions.push("LOWER(d.title) LIKE ?");
    params.push(`%${filters.query.trim().toLowerCase()}%`);
  }
  const rows = await query<Record<string, unknown>>(
    `SELECT d.*,
            (SELECT COUNT(*) FROM document_shares s WHERE s.document_id = d.id) AS share_count,
            (SELECT e.id FROM laboratory_exams e WHERE e.document_id = d.id LIMIT 1) AS exam_id
       FROM health_documents d
      WHERE ${conditions.join(" AND ")}
      ORDER BY COALESCE(d.collected_on, d.created_at) DESC, d.created_at DESC`,
    params,
  );
  return rows.map(mapDocument);
}

export async function getDocument(
  documentId: string,
): Promise<DocumentDetail | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT d.*,
            (SELECT COUNT(*) FROM document_shares s WHERE s.document_id = d.id) AS share_count,
            (SELECT e.id FROM laboratory_exams e WHERE e.document_id = d.id LIMIT 1) AS exam_id
       FROM health_documents d
      WHERE d.id = ? AND d.deleted_at IS NULL LIMIT 1`,
    [documentId],
  );
  if (!row) return null;
  return {
    ...mapDocument(row),
    userId: String(row.user_id),
    notes: row.notes ? String(row.notes) : null,
    updatedAt: String(row.updated_at),
  };
}

export async function getDocumentBlob(documentId: string): Promise<{
  data: string;
  iv: string;
  tag: string;
  version: number;
} | null> {
  const row = await queryOne<{
    data: string;
    iv: string;
    tag: string;
    version: unknown;
  }>(
    "SELECT data, iv, tag, version FROM document_blobs WHERE document_id = ? LIMIT 1",
    [documentId],
  );
  if (!row) return null;
  return {
    data: String(row.data),
    iv: String(row.iv),
    tag: String(row.tag),
    version: Number(row.version ?? 1),
  };
}

export async function listDocumentShares(
  documentId: string,
): Promise<DocumentShare[]> {
  const rows = await query<{
    community_id: string;
    name: string;
    slug: string;
    created_at: string;
  }>(
    `SELECT s.community_id, c.name, c.slug, s.created_at
       FROM document_shares s
       JOIN communities c ON c.id = s.community_id
      WHERE s.document_id = ?
      ORDER BY c.name`,
    [documentId],
  );
  return rows.map((row) => ({
    communityId: String(row.community_id),
    communityName: String(row.name),
    communitySlug: String(row.slug),
    createdAt: String(row.created_at),
  }));
}

export async function listDocumentsSharedWithCommunity(
  ownerId: string,
  communityId: string,
): Promise<DocumentSummary[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT d.*,
            (SELECT COUNT(*) FROM document_shares s2 WHERE s2.document_id = d.id) AS share_count,
            (SELECT e.id FROM laboratory_exams e WHERE e.document_id = d.id LIMIT 1) AS exam_id
       FROM health_documents d
       JOIN document_shares s ON s.document_id = d.id
      WHERE d.user_id = ? AND s.community_id = ? AND d.deleted_at IS NULL
      ORDER BY COALESCE(d.collected_on, d.created_at) DESC`,
    [ownerId, communityId],
  );
  return rows.map(mapDocument);
}

export async function countDocuments(userId: string): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM health_documents WHERE user_id = ? AND deleted_at IS NULL",
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function countDocumentsAwaitingReview(userId: string): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM health_documents WHERE user_id = ? AND deleted_at IS NULL AND status IN ('received','processing','awaiting_review')",
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

function mapExam(row: Record<string, unknown>): LabExam {
  return {
    id: String(row.id),
    documentId: row.document_id ? String(row.document_id) : null,
    labName: row.lab_name ? String(row.lab_name) : null,
    collectedOn: row.collected_on ? String(row.collected_on) : null,
    resultedOn: row.resulted_on ? String(row.resulted_on) : null,
    notes: row.notes ? String(row.notes) : null,
    status:
      row.status === "confirmed"
        ? "confirmed"
        : row.status === "awaiting_review"
          ? "awaiting_review"
          : "draft",
    createdAt: String(row.created_at),
    resultCount: Number(row.result_count ?? 0),
  };
}

export async function listExams(userId: string): Promise<LabExam[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT e.*, (SELECT COUNT(*) FROM exam_results r WHERE r.exam_id = e.id AND r.validation_status != 'rejected') AS result_count
       FROM laboratory_exams e
      WHERE e.user_id = ?
      ORDER BY COALESCE(e.collected_on, e.created_at) DESC`,
    [userId],
  );
  return rows.map(mapExam);
}

export async function getExam(
  examId: string,
  userId: string,
): Promise<LabExam | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT e.*, (SELECT COUNT(*) FROM exam_results r WHERE r.exam_id = e.id AND r.validation_status != 'rejected') AS result_count
       FROM laboratory_exams e
      WHERE e.id = ? AND e.user_id = ? LIMIT 1`,
    [examId, userId],
  );
  return row ? mapExam(row) : null;
}

export async function listExamResults(examId: string): Promise<ExamResult[]> {
  const rows = await query<Record<string, unknown>>(
    "SELECT * FROM exam_results WHERE exam_id = ? ORDER BY name ASC, created_at ASC",
    [examId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    examId: String(row.exam_id),
    name: String(row.name),
    valueText: String(row.value_text),
    valueNumeric:
      row.value_numeric === null || row.value_numeric === undefined
        ? null
        : Number(row.value_numeric),
    unit: row.unit ? String(row.unit) : null,
    referenceRange: row.reference_range ? String(row.reference_range) : null,
    flag: row.flag ? String(row.flag) : null,
    pageRef: row.page_ref ? String(row.page_ref) : null,
    extractionMethod: String(row.extraction_method),
    validationStatus:
      row.validation_status === "confirmed"
        ? "confirmed"
        : row.validation_status === "rejected"
          ? "rejected"
          : "pending",
    createdAt: String(row.created_at),
  }));
}

export async function listVaccines(userId: string): Promise<VaccineRecord[]> {
  const rows = await query<Record<string, unknown>>(
    "SELECT * FROM vaccine_records WHERE user_id = ? ORDER BY applied_on DESC, created_at DESC",
    [userId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    manufacturer: row.manufacturer ? String(row.manufacturer) : null,
    doseLabel: row.dose_label ? String(row.dose_label) : null,
    appliedOn: String(row.applied_on),
    location: row.location ? String(row.location) : null,
    status: row.status === "confirmed" ? "confirmed" : "pending",
    documentId: row.document_id ? String(row.document_id) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
  }));
}

export async function countVaccines(userId: string): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM vaccine_records WHERE user_id = ?",
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}
