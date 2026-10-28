import "server-only";
import { nowIso, query } from "@/lib/db";

export type ResetRequest = {
  userId: string;
  name: string;
  email: string;
  requestedAt: string;
  expiresAt: string;
};

export async function listResetRequests(): Promise<ResetRequest[]> {
  const rows = await query<{
    user_id: string;
    name: string;
    email: string;
    created_at: string;
    expires_at: string;
  }>(
    `SELECT r.user_id, u.name, u.email, r.created_at, r.expires_at
       FROM password_resets r
       JOIN users u ON u.id = r.user_id
      WHERE r.used_at IS NULL AND r.expires_at > ?
      ORDER BY r.created_at DESC
      LIMIT 50`,
    [nowIso()],
  );
  return rows.map((row) => ({
    userId: String(row.user_id),
    name: String(row.name),
    email: String(row.email),
    requestedAt: String(row.created_at),
    expiresAt: String(row.expires_at),
  }));
}

export async function listDataRequests(): Promise<
  Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    kind: string;
    status: string;
    notes: string | null;
    createdAt: string;
  }>
> {
  const rows = await query<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    kind: string;
    status: string;
    notes: string | null;
    created_at: string;
  }>(
    `SELECT r.id, r.user_id, u.name, u.email, r.kind, r.status, r.notes, r.created_at
       FROM data_requests r
       JOIN users u ON u.id = r.user_id
      ORDER BY r.created_at DESC
      LIMIT 50`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    email: String(row.email),
    kind: String(row.kind),
    status: String(row.status),
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
  }));
}
