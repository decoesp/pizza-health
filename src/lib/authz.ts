import "server-only";
import { query } from "@/lib/db";

export type MembershipRole = "owner" | "admin" | "member";

export type Membership = {
  id: string;
  communityId: string;
  userId: string;
  role: MembershipRole;
  joinedAt: string;
};

export function isManager(role: MembershipRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export async function membershipFor(
  userId: string,
  communityId: string,
): Promise<Membership | null> {
  const rows = await query<{
    id: string;
    community_id: string;
    user_id: string;
    role: string;
    joined_at: string;
  }>(
    "SELECT id, community_id, user_id, role, joined_at FROM community_members WHERE community_id = ? AND user_id = ? LIMIT 1",
    [communityId, userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    communityId: String(row.community_id),
    userId: String(row.user_id),
    role: row.role === "owner" || row.role === "admin" ? row.role : "member",
    joinedAt: String(row.joined_at),
  };
}

export async function canViewDocument(
  viewerId: string,
  documentId: string,
): Promise<boolean> {
  const rows = await query<{ user_id: string }>(
    "SELECT user_id FROM health_documents WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [documentId],
  );
  const owner = rows[0]?.user_id;
  if (!owner) return false;
  if (String(owner) === viewerId) return true;

  const shares = await query<{ community_id: string }>(
    "SELECT community_id FROM document_shares WHERE document_id = ?",
    [documentId],
  );
  for (const share of shares) {
    const membership = await membershipFor(viewerId, String(share.community_id));
    if (membership) return true;
  }
  return false;
}

export async function canViewSharedCategory(
  viewerId: string,
  ownerId: string,
  communityId: string,
  category: "profile" | "habits" | "vaccines" | "exams",
): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const viewer = await membershipFor(viewerId, communityId);
  if (!viewer) return false;
  const owner = await membershipFor(ownerId, communityId);
  if (!owner) return false;
  const rows = await query<{ shared: unknown }>(
    "SELECT shared FROM sharing_preferences WHERE user_id = ? AND community_id = ? AND category = ? LIMIT 1",
    [ownerId, communityId, category],
  );
  if (rows[0]) return Number(rows[0].shared) === 1;
  return category === "profile";
}

