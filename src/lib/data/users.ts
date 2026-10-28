import "server-only";
import { query, queryOne } from "@/lib/db";

export type Profile = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  bio: string | null;
  city: string | null;
  role: "user" | "admin";
  createdAt: string;
  privacyRank: boolean;
  privacyProfile: boolean;
  notifyComments: boolean;
  notifyReactions: boolean;
  notifyChallenges: boolean;
  notifyReminders: boolean;
};

export type SharingCategory = "profile" | "habits" | "vaccines" | "exams";

export type SharingPreference = {
  category: SharingCategory;
  shared: boolean;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const row = await queryOne<Record<string, unknown>>(
    "SELECT * FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [userId],
  );
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    avatarColor: String(row.avatar_color),
    bio: row.bio ? String(row.bio) : null,
    city: row.city ? String(row.city) : null,
    role: row.role === "admin" ? "admin" : "user",
    createdAt: String(row.created_at),
    privacyRank: Number(row.privacy_rank) === 1,
    privacyProfile: Number(row.privacy_profile) === 1,
    notifyComments: Number(row.notify_comments) === 1,
    notifyReactions: Number(row.notify_reactions) === 1,
    notifyChallenges: Number(row.notify_challenges) === 1,
    notifyReminders: Number(row.notify_reminders) === 1,
  };
}

export async function listSharingPreferences(
  userId: string,
  communityId: string,
): Promise<SharingPreference[]> {
  const rows = await query<{ category: string; shared: unknown }>(
    "SELECT category, shared FROM sharing_preferences WHERE user_id = ? AND community_id = ? ORDER BY category",
    [userId, communityId],
  );
  return rows.map((row) => ({
    category: row.category as SharingCategory,
    shared: Number(row.shared) === 1,
  }));
}

export async function getSharingPreference(
  userId: string,
  communityId: string,
  category: SharingCategory,
): Promise<boolean> {
  const row = await queryOne<{ shared: unknown }>(
    "SELECT shared FROM sharing_preferences WHERE user_id = ? AND community_id = ? AND category = ? LIMIT 1",
    [userId, communityId, category],
  );
  if (!row) return category === "profile";
  return Number(row.shared) === 1;
}

export async function countUserCommunities(userId: string): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM community_members WHERE user_id = ?",
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}
