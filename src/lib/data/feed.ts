import "server-only";
import { query, queryOne, placeholders } from "@/lib/db";
import { membershipFor } from "@/lib/authz";

export const REACTIONS = [
  { kind: "forca", emoji: "💪", label: "Força" },
  { kind: "apoio", emoji: "🫶", label: "Apoio" },
  { kind: "fogo", emoji: "🔥", label: "Fogo" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["kind"];

export type Post = {
  id: string;
  communityId: string;
  userId: string;
  authorName: string;
  authorColor: string;
  body: string;
  kind: string;
  refId: string | null;
  visibility: "community" | "private";
  createdAt: string;
  commentCount: number;
  reactions: Record<ReactionKind, number>;
  viewerReactions: ReactionKind[];
};

export type Comment = {
  id: string;
  userId: string;
  authorName: string;
  authorColor: string;
  body: string;
  createdAt: string;
};

export type Report = {
  id: string;
  postId: string;
  postBody: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
};

export const FEED_PAGE_SIZE = 10;

type PostRow = {
  id: string;
  community_id: string;
  user_id: string;
  body: string;
  kind: string;
  ref_id: string | null;
  visibility: string;
  created_at: string;
  name: string;
  avatar_color: string;
};

function emptyReactions(): Record<ReactionKind, number> {
  return { forca: 0, apoio: 0, fogo: 0 };
}

export async function countFeedPosts(
  communityId: string,
  viewerId: string,
): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM posts WHERE community_id = ? AND deleted_at IS NULL AND (visibility = 'community' OR user_id = ?)",
    [communityId, viewerId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function listFeed(
  communityId: string,
  viewerId: string,
  page = 1,
  pageSize = FEED_PAGE_SIZE,
): Promise<{ posts: Post[]; total: number; page: number; pages: number }> {
  const membership = await membershipFor(viewerId, communityId);
  if (!membership) {
    return { posts: [], total: 0, page: 1, pages: 1 };
  }
  const total = await countFeedPosts(communityId, viewerId);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const rows = await query<PostRow>(
    `SELECT p.id, p.community_id, p.user_id, p.body, p.kind, p.ref_id, p.visibility, p.created_at,
            u.name, u.avatar_color
       FROM posts p
       JOIN users u ON u.id = p.user_id
      WHERE p.community_id = ? AND p.deleted_at IS NULL
        AND (p.visibility = 'community' OR p.user_id = ?)
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?`,
    [communityId, viewerId, pageSize, (safePage - 1) * pageSize],
  );

  if (rows.length === 0) {
    return { posts: [], total, page: safePage, pages };
  }

  const ids = rows.map((row) => String(row.id));
  const inSql = placeholders(ids.length);

  const [commentRows, reactionRows, viewerRows] = await Promise.all([
    query<{ post_id: string; total: unknown }>(
      `SELECT post_id, COUNT(*) AS total FROM comments WHERE post_id IN (${inSql}) AND deleted_at IS NULL GROUP BY post_id`,
      ids,
    ),
    query<{ post_id: string; kind: string; total: unknown }>(
      `SELECT post_id, kind, COUNT(*) AS total FROM reactions WHERE post_id IN (${inSql}) GROUP BY post_id, kind`,
      ids,
    ),
    query<{ post_id: string; kind: string }>(
      `SELECT post_id, kind FROM reactions WHERE user_id = ? AND post_id IN (${inSql})`,
      [viewerId, ...ids],
    ),
  ]);

  const commentCounts = new Map<string, number>();
  for (const row of commentRows) {
    commentCounts.set(String(row.post_id), Number(row.total ?? 0));
  }
  const reactionCounts = new Map<string, Record<ReactionKind, number>>();
  for (const row of reactionRows) {
    const postId = String(row.post_id);
    const current = reactionCounts.get(postId) ?? emptyReactions();
    const kind = row.kind as ReactionKind;
    if (kind in current) current[kind] = Number(row.total ?? 0);
    reactionCounts.set(postId, current);
  }
  const viewerReactions = new Map<string, ReactionKind[]>();
  for (const row of viewerRows) {
    const postId = String(row.post_id);
    const list = viewerReactions.get(postId) ?? [];
    list.push(row.kind as ReactionKind);
    viewerReactions.set(postId, list);
  }

  return {
    posts: rows.map((row) => ({
      id: String(row.id),
      communityId: String(row.community_id),
      userId: String(row.user_id),
      authorName: String(row.name),
      authorColor: String(row.avatar_color),
      body: String(row.body),
      kind: String(row.kind),
      refId: row.ref_id ? String(row.ref_id) : null,
      visibility: row.visibility === "private" ? "private" : "community",
      createdAt: String(row.created_at),
      commentCount: commentCounts.get(String(row.id)) ?? 0,
      reactions: reactionCounts.get(String(row.id)) ?? emptyReactions(),
      viewerReactions: viewerReactions.get(String(row.id)) ?? [],
    })),
    total,
    page: safePage,
    pages,
  };
}

export async function getPost(postId: string): Promise<Post | null> {
  const row = await queryOne<PostRow>(
    `SELECT p.id, p.community_id, p.user_id, p.body, p.kind, p.ref_id, p.visibility, p.created_at,
            u.name, u.avatar_color
       FROM posts p
       JOIN users u ON u.id = p.user_id
      WHERE p.id = ? AND p.deleted_at IS NULL LIMIT 1`,
    [postId],
  );
  if (!row) return null;
  return {
    id: String(row.id),
    communityId: String(row.community_id),
    userId: String(row.user_id),
    authorName: String(row.name),
    authorColor: String(row.avatar_color),
    body: String(row.body),
    kind: String(row.kind),
    refId: row.ref_id ? String(row.ref_id) : null,
    visibility: row.visibility === "private" ? "private" : "community",
    createdAt: String(row.created_at),
    commentCount: 0,
    reactions: emptyReactions(),
    viewerReactions: [],
  };
}

export async function listComments(postId: string): Promise<Comment[]> {
  const rows = await query<{
    id: string;
    user_id: string;
    name: string;
    avatar_color: string;
    body: string;
    created_at: string;
  }>(
    `SELECT c.id, c.user_id, u.name, u.avatar_color, c.body, c.created_at
       FROM comments c
       JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ? AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
      LIMIT 100`,
    [postId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    authorName: String(row.name),
    authorColor: String(row.avatar_color),
    body: String(row.body),
    createdAt: String(row.created_at),
  }));
}

export async function listCommentsForPosts(
  postIds: string[],
): Promise<Record<string, Comment[]>> {
  const grouped: Record<string, Comment[]> = {};
  for (const id of postIds) grouped[id] = [];
  if (postIds.length === 0) return grouped;
  const inSql = placeholders(postIds.length);
  const rows = await query<{
    id: string;
    post_id: string;
    user_id: string;
    name: string;
    avatar_color: string;
    body: string;
    created_at: string;
  }>(
    `SELECT c.id, c.post_id, c.user_id, u.name, u.avatar_color, c.body, c.created_at
       FROM comments c
       JOIN users u ON u.id = c.user_id
      WHERE c.post_id IN (${inSql}) AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC
      LIMIT 300`,
    postIds,
  );
  for (const row of rows) {
    const postId = String(row.post_id);
    const list = grouped[postId] ?? [];
    list.push({
      id: String(row.id),
      userId: String(row.user_id),
      authorName: String(row.name),
      authorColor: String(row.avatar_color),
      body: String(row.body),
      createdAt: String(row.created_at),
    });
    grouped[postId] = list;
  }
  return grouped;
}

export async function listReports(communityId: string): Promise<Report[]> {
  const rows = await query<{
    id: string;
    post_id: string;
    post_body: string;
    reporter_id: string;
    reporter_name: string;
    reason: string;
    details: string | null;
    status: string;
    created_at: string;
  }>(
    `SELECT r.id, r.post_id, p.body AS post_body, r.reporter_id, u.name AS reporter_name,
            r.reason, r.details, r.status, r.created_at
       FROM content_reports r
       JOIN posts p ON p.id = r.post_id
       JOIN users u ON u.id = r.reporter_id
      WHERE p.community_id = ?
      ORDER BY r.created_at DESC
      LIMIT 50`,
    [communityId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    postId: String(row.post_id),
    postBody: String(row.post_body),
    reporterId: String(row.reporter_id),
    reporterName: String(row.reporter_name),
    reason: String(row.reason),
    details: row.details ? String(row.details) : null,
    status: String(row.status),
    createdAt: String(row.created_at),
  }));
}
