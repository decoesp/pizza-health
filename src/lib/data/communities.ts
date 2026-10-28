import "server-only";
import { query, queryOne } from "@/lib/db";
import { membershipFor, type MembershipRole } from "@/lib/authz";

export type CommunitySummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  role: MembershipRole;
  memberCount: number;
  createdAt: string;
};

export type CommunityMember = {
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  role: MembershipRole;
  joinedAt: string;
  bio: string | null;
  city: string | null;
};

export type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  inviteExpiresAt: string | null;
  hasInvite: boolean;
};

function role(value: unknown): MembershipRole {
  return value === "owner" || value === "admin" ? value : "member";
}

export async function listCommunitiesForUser(
  userId: string,
): Promise<CommunitySummary[]> {
  const rows = await query<{
    id: string;
    slug: string;
    name: string;
    description: string;
    role: string;
    member_count: unknown;
    created_at: string;
  }>(
    `SELECT c.id, c.slug, c.name, c.description, m.role, c.created_at,
            (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id) AS member_count
       FROM communities c
       JOIN community_members m ON m.community_id = c.id
      WHERE m.user_id = ? AND c.archived_at IS NULL
      ORDER BY c.name`,
    [userId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description),
    role: role(row.role),
    memberCount: Number(row.member_count ?? 0),
    createdAt: String(row.created_at),
  }));
}

export async function getCommunityBySlug(slug: string): Promise<Community | null> {
  const row = await queryOne<{
    id: string;
    slug: string;
    name: string;
    description: string;
    created_by: string;
    created_at: string;
    invite_expires_at: string | null;
    invite_token_hash: string | null;
  }>(
    "SELECT id, slug, name, description, created_by, created_at, invite_expires_at, invite_token_hash FROM communities WHERE slug = ? AND archived_at IS NULL LIMIT 1",
    [slug],
  );
  if (!row) return null;
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    inviteExpiresAt: row.invite_expires_at ? String(row.invite_expires_at) : null,
    hasInvite: Boolean(row.invite_token_hash),
  };
}

export async function getCommunityById(id: string): Promise<Community | null> {
  const row = await queryOne<{ slug: string }>(
    "SELECT slug FROM communities WHERE id = ? AND archived_at IS NULL LIMIT 1",
    [id],
  );
  if (!row) return null;
  return getCommunityBySlug(String(row.slug));
}

export async function listMembers(communityId: string): Promise<CommunityMember[]> {
  const rows = await query<{
    user_id: string;
    name: string;
    email: string;
    avatar_color: string;
    role: string;
    joined_at: string;
    bio: string | null;
    city: string | null;
  }>(
    `SELECT m.user_id, u.name, u.email, u.avatar_color, m.role, m.joined_at, u.bio, u.city
       FROM community_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.community_id = ? AND u.deleted_at IS NULL
      ORDER BY m.joined_at ASC`,
    [communityId],
  );
  return rows.map((row) => ({
    userId: String(row.user_id),
    name: String(row.name),
    email: String(row.email),
    avatarColor: String(row.avatar_color),
    role: role(row.role),
    joinedAt: String(row.joined_at),
    bio: row.bio ? String(row.bio) : null,
    city: row.city ? String(row.city) : null,
  }));
}

export async function getMember(
  communityId: string,
  userId: string,
): Promise<CommunityMember | null> {
  const member = await membershipFor(userId, communityId);
  if (!member) return null;
  const members = await listMembers(communityId);
  return members.find((item) => item.userId === userId) ?? null;
}

export async function findCommunityByInviteHash(hash: string) {
  return queryOne<{
    id: string;
    slug: string;
    name: string;
    description: string;
    created_by: string;
    created_at: string;
    invite_expires_at: string | null;
    invite_token_hash: string | null;
  }>(
    "SELECT id, slug, name, description, created_by, created_at, invite_expires_at, invite_token_hash FROM communities WHERE invite_token_hash = ? AND archived_at IS NULL LIMIT 1",
    [hash],
  );
}

export async function membershipCount(communityId: string): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM community_members WHERE community_id = ?",
    [communityId],
  );
  return Number(rows[0]?.total ?? 0);
}

export type MemberActivity = {
  habitEntries: number;
  posts: number;
  challenges: number;
  streak: number;
};

export async function getMemberActivity(
  communityId: string,
  userId: string,
): Promise<MemberActivity> {
  const [habits, posts, challenges] = await Promise.all([
    query<{ total: unknown }>(
      "SELECT COUNT(*) AS total FROM habit_entries WHERE user_id = ? AND entry_date >= ?",
      [userId, new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)],
    ),
    query<{ total: unknown }>(
      "SELECT COUNT(*) AS total FROM posts WHERE user_id = ? AND community_id = ? AND deleted_at IS NULL",
      [userId, communityId],
    ),
    query<{ total: unknown }>(
      "SELECT COUNT(*) AS total FROM challenge_participants cp JOIN challenges c ON c.id = cp.challenge_id WHERE cp.user_id = ? AND c.community_id = ?",
      [userId, communityId],
    ),
  ]);
  return {
    habitEntries: Number(habits[0]?.total ?? 0),
    posts: Number(posts[0]?.total ?? 0),
    challenges: Number(challenges[0]?.total ?? 0),
    streak: 0,
  };
}
