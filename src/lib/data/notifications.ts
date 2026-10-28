import "server-only";
import { query } from "@/lib/db";

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  actorName: string | null;
  actorColor: string | null;
};

export const NOTIFICATION_PAGE_SIZE = 20;

export async function listNotifications(
  userId: string,
  page = 1,
): Promise<{ items: Notification[]; total: number; pages: number; page: number }> {
  const countRows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?",
    [userId],
  );
  const total = Number(countRows[0]?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / NOTIFICATION_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pages);
  const rows = await query<{
    id: string;
    kind: string;
    title: string;
    body: string;
    href: string | null;
    read_at: string | null;
    created_at: string;
    name: string | null;
    avatar_color: string | null;
  }>(
    `SELECT n.id, n.kind, n.title, n.body, n.href, n.read_at, n.created_at,
            u.name, u.avatar_color
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT ? OFFSET ?`,
    [userId, NOTIFICATION_PAGE_SIZE, (safePage - 1) * NOTIFICATION_PAGE_SIZE],
  );
  return {
    items: rows.map((row) => ({
      id: String(row.id),
      kind: String(row.kind),
      title: String(row.title),
      body: String(row.body),
      href: row.href ? String(row.href) : null,
      readAt: row.read_at ? String(row.read_at) : null,
      createdAt: String(row.created_at),
      actorName: row.name ? String(row.name) : null,
      actorColor: row.avatar_color ? String(row.avatar_color) : null,
    })),
    total,
    pages,
    page: safePage,
  };
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  const rows = await query<{ total: unknown }>(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL",
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}
