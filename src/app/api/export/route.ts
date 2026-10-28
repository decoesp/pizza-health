import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { listCommunitiesForUser } from "@/lib/data/communities";
import { listHabitTypes, listEntries, listGoals } from "@/lib/data/habits";
import {
  listDocuments,
  getDocumentBlob,
  listExams,
  listExamResults,
  listVaccines,
} from "@/lib/data/documents";
import { decryptBytes } from "@/lib/crypto/documents";
import { listChallengesForUser } from "@/lib/data/challenges";
import { listAchievements, pointsTotal } from "@/lib/data/points";
import { listNotifications } from "@/lib/data/notifications";
import { recordAudit } from "@/lib/audit";
import { todayIso } from "@/lib/domain/dates";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const includeFiles = request.nextUrl.searchParams.get("files") === "1";
  const [communities, habits, entries, goals] = await Promise.all([
    listCommunitiesForUser(user.id),
    listHabitTypes(user.id),
    listEntries(user.id, "1900-01-01", todayIso()),
    listGoals(user.id),
  ]);
  const [documents, exams, vaccines, challenges, achievements, points, notifications] =
    await Promise.all([
      listDocuments(user.id),
      listExams(user.id),
      listVaccines(user.id),
      listChallengesForUser(user.id),
      listAchievements(user.id),
      pointsTotal(user.id),
      listNotifications(user.id, 1),
    ]);

  const examDetails = [];
  for (const exam of exams) {
    examDetails.push({ ...exam, results: await listExamResults(exam.id) });
  }

  let fileBudget = MAX_FILE_BYTES;
  const documentsWithFiles = [];
  for (const document of documents) {
    if (!includeFiles) {
      documentsWithFiles.push(document);
      continue;
    }
    if (document.sizeBytes > fileBudget) {
      documentsWithFiles.push({
        ...document,
        exportNote: "Arquivo omitido: limite de 20 MB para o pacote de exportação.",
      });
      continue;
    }
    const blob = await getDocumentBlob(document.id);
    if (!blob) {
      documentsWithFiles.push(document);
      continue;
    }
    const bytes = decryptBytes(blob);
    fileBudget -= bytes.length;
    documentsWithFiles.push({
      ...document,
      contentBase64: bytes.toString("base64"),
    });
  }

  const account = await query<Record<string, unknown>>(
    "SELECT id, email, name, role, avatar_color, bio, city, privacy_rank, privacy_profile, created_at, updated_at FROM users WHERE id = ?",
    [user.id],
  );
  const posts = await query<Record<string, unknown>>(
    "SELECT id, community_id, body, kind, visibility, created_at FROM posts WHERE user_id = ? AND deleted_at IS NULL",
    [user.id],
  );
  const comments = await query<Record<string, unknown>>(
    "SELECT id, post_id, body, created_at FROM comments WHERE user_id = ? AND deleted_at IS NULL",
    [user.id],
  );
  const reactions = await query<Record<string, unknown>>(
    "SELECT id, post_id, kind, created_at FROM reactions WHERE user_id = ?",
    [user.id],
  );
  const consents = await query<Record<string, unknown>>(
    "SELECT kind, version, accepted_at FROM legal_acceptances WHERE user_id = ?",
    [user.id],
  );
  const pointRows = await query<Record<string, unknown>>(
    "SELECT kind, points, ref_type, created_at FROM point_transactions WHERE user_id = ?",
    [user.id],
  );

  const payload = {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    account: account[0] ?? null,
    communities,
    sharingPreferences: await query<Record<string, unknown>>(
      "SELECT community_id, category, shared, updated_at FROM sharing_preferences WHERE user_id = ?",
      [user.id],
    ),
    consents,
    habits,
    entries,
    goals,
    posts,
    comments,
    reactions,
    documents: documentsWithFiles,
    exams: examDetails,
    vaccines,
    challenges,
    achievements,
    points: { total: points, transactions: pointRows },
    notifications: notifications.items,
    dataRequests: await query<Record<string, unknown>>(
      "SELECT kind, status, notes, created_at, processed_at FROM data_requests WHERE user_id = ?",
      [user.id],
    ),
    auditEvents: await query<Record<string, unknown>>(
      "SELECT action, entity_type, community_id, created_at FROM audit_events WHERE actor_id = ?",
      [user.id],
    ),
  };

  await recordAudit({
    actorId: user.id,
    action: "data.export_download",
    entityType: "user",
    entityId: user.id,
    metadata: { includeFiles },
  });

  const body = JSON.stringify(payload, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pizza-health-${user.id}-${todayIso()}.json"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
