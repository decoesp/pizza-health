import "./setup-env";
import { rmSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { closeDb, execute, newId, nowIso } from "../src/lib/db";
import { migrate } from "../src/lib/db/migrate";
import { canViewDocument, canViewSharedCategory, membershipFor } from "../src/lib/authz";
import {
  awardPoints,
  awardSocial,
  pointsTotal,
  socialPointsToday,
} from "../src/lib/data/points";
import { listFeed } from "../src/lib/data/feed";
import { query, queryOne } from "../src/lib/db";

const ids = {
  u1: "usr_test_1",
  u2: "usr_test_2",
  u3: "usr_test_3",
  c1: "com_test_1",
  c2: "com_test_2",
};

async function createUser(id: string, email: string) {
  const now = nowIso();
  await execute(
    `INSERT INTO users (id, email, name, password_hash, role, avatar_color, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, email, `Pessoa ${id}`, "scrypt$1$1$1$x$y", "user", "#D9552F", now, now],
  );
}

before(async () => {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`.data/test-pizza-health.db${suffix}`, { force: true });
  }
  await migrate();
  await createUser(ids.u1, "u1@test.local");
  await createUser(ids.u2, "u2@test.local");
  await createUser(ids.u3, "u3@test.local");
  const now = nowIso();
  await execute(
    "INSERT INTO communities (id, slug, name, description, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
    [ids.c1, "comunidade-1", "Comunidade 1", "", ids.u1, now, now],
  );
  await execute(
    "INSERT INTO communities (id, slug, name, description, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
    [ids.c2, "comunidade-2", "Comunidade 2", "", ids.u2, now, now],
  );
  await execute(
    "INSERT INTO community_members (id, community_id, user_id, role, joined_at) VALUES (?,?,?,?,?)",
    [newId("mem"), ids.c1, ids.u1, "owner", now],
  );
  await execute(
    "INSERT INTO community_members (id, community_id, user_id, role, joined_at) VALUES (?,?,?,?,?)",
    [newId("mem"), ids.c1, ids.u2, "member", now],
  );
  await execute(
    "INSERT INTO community_members (id, community_id, user_id, role, joined_at) VALUES (?,?,?,?,?)",
    [newId("mem"), ids.c2, ids.u2, "owner", now],
  );
  for (const category of ["profile", "habits", "vaccines", "exams"]) {
    await execute(
      "INSERT INTO sharing_preferences (id, user_id, community_id, category, shared, updated_at) VALUES (?,?,?,?,?,?)",
      [newId("shr"), ids.u1, ids.c1, category, category === "profile" ? 1 : 0, now],
    );
  }
});

after(async () => {
  await closeDb();
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`.data/test-pizza-health.db${suffix}`, { force: true });
  }
});

describe("isolamento e autorização", () => {
  it("reconhece apenas membros da comunidade", async () => {
    assert.equal((await membershipFor(ids.u1, ids.c1))?.role, "owner");
    assert.equal((await membershipFor(ids.u2, ids.c1))?.role, "member");
    assert.equal(await membershipFor(ids.u3, ids.c1), null);
  });

  it("bloqueia categoria não compartilhada e libera após consentimento", async () => {
    assert.equal(await canViewSharedCategory(ids.u2, ids.u1, ids.c1, "habits"), false);
    await execute(
      "UPDATE sharing_preferences SET shared = 1 WHERE user_id = ? AND community_id = ? AND category = 'habits'",
      [ids.u1, ids.c1],
    );
    assert.equal(await canViewSharedCategory(ids.u2, ids.u1, ids.c1, "habits"), true);
    assert.equal(await canViewSharedCategory(ids.u3, ids.u1, ids.c1, "habits"), false);
  });

  it("exige documento privado e libera apenas com compartilhamento explícito", async () => {
    const documentId = "doc_test_1";
    const now = nowIso();
    await execute(
      `INSERT INTO health_documents (id, user_id, title, category, file_name, mime_type, size_bytes, sha256, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [documentId, ids.u1, "Exame privado", "exam", "exame.pdf", "application/pdf", 10, "hash-teste", "received", now, now],
    );
    assert.equal(await canViewDocument(ids.u1, documentId), true);
    assert.equal(await canViewDocument(ids.u2, documentId), false);
    await execute(
      "INSERT INTO document_shares (id, document_id, community_id, shared_by, created_at) VALUES (?,?,?,?,?)",
      [newId("dsh"), documentId, ids.c1, ids.u1, now],
    );
    assert.equal(await canViewDocument(ids.u2, documentId), true);
    assert.equal(await canViewDocument(ids.u3, documentId), false);
    await execute("DELETE FROM document_shares WHERE document_id = ?", [documentId]);
    assert.equal(await canViewDocument(ids.u2, documentId), false);
  });

  it("mantém o feed restrito à comunidade", async () => {
    const now = nowIso();
    await execute(
      "INSERT INTO posts (id, community_id, user_id, body, kind, visibility, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
      ["post_test_1", ids.c1, ids.u1, "Só na comunidade 1", "text", "community", now, now],
    );
    await execute(
      "INSERT INTO posts (id, community_id, user_id, body, kind, visibility, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
      ["post_test_2", ids.c2, ids.u2, "Só na comunidade 2", "text", "community", now, now],
    );
    const feed1 = await listFeed(ids.c1, ids.u1, 1);
    assert.ok(feed1.posts.some((post) => post.id === "post_test_1"));
    assert.ok(!feed1.posts.some((post) => post.id === "post_test_2"));
    const feed2 = await listFeed(ids.c2, ids.u1, 1);
    assert.equal(feed2.posts.length, 0);
  });
});

describe("pontuação idempotente", () => {
  it("não duplica pontos do mesmo registro", async () => {
    const created = await awardPoints({
      userId: ids.u1,
      kind: "habit",
      refType: "habit_entry",
      refId: "habit-type-1:2026-10-27",
      points: 10,
    });
    const duplicate = await awardPoints({
      userId: ids.u1,
      kind: "habit",
      refType: "habit_entry",
      refId: "habit-type-1:2026-10-27",
      points: 10,
    });
    assert.equal(created, true);
    assert.equal(duplicate, false);
    assert.equal(await pointsTotal(ids.u1), 10);
    const rows = await query<{ total: unknown }>(
      "SELECT COUNT(*) AS total FROM point_transactions WHERE user_id = ? AND kind = 'habit'",
      [ids.u1],
    );
    assert.equal(Number(rows[0]?.total), 1);
  });

  it("respeita o teto diário de pontos sociais", async () => {
    for (let index = 0; index < 20; index += 1) {
      await awardSocial(ids.u1, "comment", "comment", `comment-${index}`);
    }
    assert.ok((await socialPointsToday(ids.u1)) <= 10);
    assert.equal(await pointsTotal(ids.u1), 20);
    const row = await queryOne<{ total: unknown }>(
      "SELECT COUNT(*) AS total FROM point_transactions WHERE user_id = ? AND kind = 'comment'",
      [ids.u1],
    );
    assert.equal(Number(row?.total), 5);
  });
});
