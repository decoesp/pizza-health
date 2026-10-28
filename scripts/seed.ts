import "./_env";
import {
  closeDb,
  dbMode,
  execute,
  nowIso,
  query,
  queryOne,
} from "../src/lib/db";
import { migrate } from "../src/lib/db/migrate";
import { hashPassword } from "../src/lib/auth/password";
import { addDays, startOfWeek, todayIso } from "../src/lib/domain/dates";

type SeedUser = {
  id: string;
  email: string;
  name: string;
  color: string;
  role: "user" | "admin";
  bio: string;
  city: string;
  rank: number;
};

const DEMO_USERS: SeedUser[] = [
  {
    id: "usr_ana",
    email: "ana@pizzahealth.app",
    name: "Ana Ribeiro",
    color: "#C2410C",
    role: "admin",
    bio: "Gosto de cozinhar, caminhar e lembrar os amigos de beber água.",
    city: "São Paulo",
    rank: 1,
  },
  {
    id: "usr_bruno",
    email: "bruno@pizzahealth.app",
    name: "Bruno Salles",
    color: "#3F6B4F",
    role: "user",
    bio: "Corrida de rua e playlists longas.",
    city: "Campinas",
    rank: 1,
  },
  {
    id: "usr_carla",
    email: "carla@pizzahealth.app",
    name: "Carla Nunes",
    color: "#8A5A0F",
    role: "user",
    bio: "Durmo melhor quando leio antes de dormir.",
    city: "Belo Horizonte",
    rank: 1,
  },
  {
    id: "usr_diego",
    email: "diego@pizzahealth.app",
    name: "Diego Alves",
    color: "#4C6FA8",
    role: "user",
    bio: "Aprendendo a cozinhar sem queimar a panela.",
    city: "Curitiba",
    rank: 0,
  },
  {
    id: "usr_eva",
    email: "eva@pizzahealth.app",
    name: "Eva Martins",
    color: "#8A5A8F",
    role: "user",
    bio: "Yoga, trilhas e café.",
    city: "Recife",
    rank: 1,
  },
];

const HABITS = [
  { slug: "agua", name: "Água", unit: "ml", icon: "drop", target: 2000 },
  { slug: "movimento", name: "Movimento", unit: "min", icon: "move", target: 30 },
  { slug: "sono", name: "Sono", unit: "h", icon: "moon", target: 7 },
];

function yesNo(value: boolean): number {
  return value ? 1 : 0;
}

async function ensureUser(
  user: SeedUser,
  passwordHash: string,
  createdAt: string,
): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [user.email],
  );
  if (existing) return String(existing.id);
  await execute(
    `INSERT INTO users (id, email, name, password_hash, role, avatar_color, bio, city,
      privacy_rank, privacy_profile, notify_comments, notify_reactions, notify_challenges,
      notify_reminders, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      user.id,
      user.email,
      user.name,
      passwordHash,
      user.role,
      user.color,
      user.bio,
      user.city,
      user.rank,
      1,
      1,
      1,
      1,
      1,
      createdAt,
      createdAt,
    ],
  );
  return user.id;
}

async function main() {
  const env = process.env;
  console.log(`[seed] modo ${dbMode()}`);
  await migrate();

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error(
      "Defina ADMIN_EMAIL e ADMIN_PASSWORD para criar a conta administrativa.",
    );
  }
  if (env.SEED_DEMO === "1" && !env.SEED_DEMO_PASSWORD) {
    throw new Error("SEED_DEMO=1 exige SEED_DEMO_PASSWORD.");
  }

  const now = nowIso();
  const demoPasswordHash = await hashPassword(
    env.SEED_DEMO_PASSWORD ?? env.ADMIN_PASSWORD,
  );
  const adminPasswordHash = await hashPassword(env.ADMIN_PASSWORD);

  const admin: SeedUser = {
    id: "usr_ana",
    email: env.ADMIN_EMAIL.toLowerCase(),
    name: "Ana Ribeiro",
    color: "#C2410C",
    role: "admin",
    bio: "Gosto de cozinhar, caminhar e lembrar os amigos de beber água.",
    city: "São Paulo",
    rank: 1,
  };
  const adminId = await ensureUser(
    admin,
    env.ADMIN_EMAIL.toLowerCase() === "ana@pizzahealth.app"
      ? demoPasswordHash
      : adminPasswordHash,
    now,
  );

  const userIds: Record<string, string> = { ana: adminId };
  const uid = (key: string): string => {
    const value = userIds[key];
    if (!value) throw new Error(`Usuário demo ausente: ${key}`);
    return value;
  };

  if (env.SEED_DEMO === "1") {
    for (const user of DEMO_USERS) {
      if (user.id === "usr_ana") {
        // A conta admin pode ter e-mail diferente do demo; garante o vínculo.
        continue;
      }
      userIds[user.id.replace("usr_", "")] = await ensureUser(
        user,
        demoPasswordHash,
        now,
      );
    }

    const communityId = "com_mesa";
    const existingCommunity = await queryOne<{ id: string }>(
      "SELECT id FROM communities WHERE id = ? LIMIT 1",
      [communityId],
    );
    if (!existingCommunity) {
      await execute(
        `INSERT INTO communities (id, slug, name, description, created_by, invite_token_hash, invite_expires_at, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          communityId,
          "mesa-de-domingo",
          "Mesa de Domingo",
          "Amigos que fazem check-up junto, compartilham hábitos e lembram uns aos outros de se cuidar.",
          uid("ana"),
          null,
          null,
          now,
          now,
        ],
      );
    }

    const members: Array<[string, string, string]> = [
      [uid("ana") ?? adminId, "owner", addDays(todayIso(), -40)],
      [uid("bruno") ?? "", "admin", addDays(todayIso(), -35)],
      [uid("carla") ?? "", "member", addDays(todayIso(), -30)],
      [uid("diego") ?? "", "member", addDays(todayIso(), -18)],
      [uid("eva") ?? "", "member", addDays(todayIso(), -10)],
    ];
    for (const [userId, role, joinedAt] of members) {
      if (!userId) continue;
      await execute(
        "INSERT INTO community_members (id, community_id, user_id, role, joined_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING",
        [`mem_${userId}`, communityId, userId, role, `${joinedAt}T12:00:00.000Z`],
      );
    }

    const categories = ["profile", "habits", "vaccines", "exams"] as const;
    const sharedFor: Record<string, string[]> = {
      profile: ["ana", "bruno", "carla", "diego", "eva"],
      habits: ["ana", "bruno", "carla"],
      vaccines: ["ana", "bruno"],
      exams: ["ana"],
    };
    for (const [key, userId] of Object.entries(userIds)) {
      for (const category of categories) {
        await execute(
          "INSERT INTO sharing_preferences (id, user_id, community_id, category, shared, updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING",
          [
            `shr_${key}_${category}`,
            userId,
            communityId,
            category,
            yesNo(sharedFor[category]?.includes(key) ?? false),
            now,
          ],
        );
      }
    }

    // Tipos de hábito por pessoa: o desafio referencia o slug, nunca o id de
    // uma pessoa específica.
    const habitIds: Record<string, Record<string, string>> = {};
    for (const [key, userId] of Object.entries(userIds)) {
      habitIds[key] = {};
      for (const habit of HABITS) {
        const id = `ht_${key}_${habit.slug}`;
        await execute(
          "INSERT INTO habit_types (id, user_id, slug, name, unit, icon, target_value, direction, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
          [
            id,
            userId,
            habit.slug,
            habit.name,
            habit.unit,
            habit.icon,
            habit.target,
            "at_least",
            1,
            `${addDays(todayIso(), -45)}T12:00:00.000Z`,
          ],
        );
        habitIds[key]![habit.slug] = id;
      }
    }

    const participation: Record<string, Record<string, number[]>> = {
      ana: { agua: [-11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0], movimento: [-10, -8, -6, -4, -2, 0], sono: [-11, -10, -9, -8, -7, -6, -5, -3, -2, -1, 0] },
      bruno: { agua: [-11, -10, -9, -8, -7, -5, -3, -2, -1, 0], movimento: [-10, -7, -4, -1], sono: [-10, -9, -7, -6, -4, -2, -1, 0] },
      carla: { agua: [-10, -8, -6, -4, -2, -1, 0], movimento: [-8, -4], sono: [-10, -9, -7, -5, -3, -1, 0] },
      diego: { agua: [-8, -3, 0], movimento: [-6], sono: [-9, -4, 0] },
      eva: { agua: [-9, -7, -6, -4, -2, 0], movimento: [-8, -5, -2], sono: [-9, -7, -5, -4, -2, -1, 0] },
    };

    const today = todayIso();
    const dayDate = (offset: number) => addDays(today, offset);

    for (const [key, plan] of Object.entries(participation)) {
      const userId = userIds[key];
      if (!userId) continue;
      for (const [slug, offsets] of Object.entries(plan)) {
        for (const offset of offsets) {
          const date = dayDate(offset);
          const seedValue =
            slug === "agua"
              ? 1750 + ((offset + 12) * 137) % 950
              : slug === "movimento"
                ? 20 + ((offset + 12) * 11) % 55
                : 6.5 + ((offset + 12) % 3) * 0.5;
          const amount = Math.round(seedValue * 10) / 10;
          const entryId = `entry_${key}_${slug}_${date}`;
          const createdAt = `${date}T12:00:00.000Z`;
          await execute(
            "INSERT INTO habit_entries (id, user_id, habit_type_id, entry_date, amount, note, source, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
            [
              entryId,
              userId,
              habitIds[key]?.[slug] ?? "",
              date,
              amount,
              offset === 0 && slug === "agua" ? "Meta do dia batida." : null,
              "manual",
              createdAt,
              createdAt,
            ],
          );
          await execute(
            "INSERT INTO point_transactions (id, user_id, kind, ref_type, ref_id, points, created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
            [
              `pts_habit_${key}_${slug}_${date}`,
              userId,
              "habit",
              "habit_entry",
              `${habitIds[key]?.[slug] ?? ""}:${date}`,
              10,
              createdAt,
            ],
          );
        }
      }
    }

    await execute(
      "INSERT INTO personal_goals (id, user_id, habit_type_id, title, target_value, period, starts_on, ends_on, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
      [
        "goal_ana_agua",
        uid("ana"),
        habitIds.ana?.agua ?? "",
        "Beber 2 L por dia",
        2000,
        "daily",
        addDays(today, -30),
        null,
        "active",
        now,
      ],
    );
    await execute(
      "INSERT INTO personal_goals (id, user_id, habit_type_id, title, target_value, period, starts_on, ends_on, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
      [
        "goal_bruno_move",
        uid("bruno"),
        habitIds.bruno?.movimento ?? "",
        "150 minutos de movimento na semana",
        150,
        "weekly",
        startOfWeek(today),
        null,
        "active",
        now,
      ],
    );

    const posts: Array<[string, string, string, string, string, string | null, number]> = [
      ["post_1", "ana", "Comecei a semana colocando a garrafa na mesa antes de abrir o notebook. Pequeno ritual, grande diferença.", "text", "community", null, -2],
      ["post_2", "bruno", "Ontem fechei o dia com 2,3 L de água. Quem mais está na meta?", "habit", "community", `entry_bruno_agua_${dayDate(-1)}`, -1],
      ["post_3", "carla", "Marquei meu check-up anual. Não é sobre estar doente: é sobre ter uma linha de base para comparar depois.", "milestone", "community", null, -3],
      ["post_4", "diego", "Alguém tem dica para lembrar de beber água no meio do trabalho? Meu copo fica longe da mesa.", "text", "community", null, -4],
      ["post_5", "eva", "Fechei sete dias seguidos registrando meus hábitos. O objetivo não é perfeição, é não perder o fio.", "milestone", "community", null, 0],
    ];
    for (const [id, key, body, kind, visibility, refId, offset] of posts) {
      const author = userIds[key];
      if (!author) continue;
      await execute(
        "INSERT INTO posts (id, community_id, user_id, body, kind, ref_id, visibility, created_at, updated_at, deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
        [
          id,
          communityId,
          author,
          body,
          kind,
          refId,
          visibility,
          `${dayDate(offset)}T15:00:00.000Z`,
          `${dayDate(offset)}T15:00:00.000Z`,
          null,
        ],
      );
    }

    const comments: Array<[string, string, string, string, number]> = [
      ["comment_1", "post_1", "bruno", "Boa! Vou copiar o ritual da garrafa.", -2],
      ["comment_2", "post_4", "ana", "Deixa um copo cheio na mesa e usa o alarme do celular. Funciona melhor do que lembrar.", -4],
      ["comment_3", "post_2", "carla", "Isso aí! Hoje vou tentar chegar nos 2 L também.", -1],
    ];
    for (const [id, postId, key, body, offset] of comments) {
      const author = userIds[key];
      if (!author) continue;
      await execute(
        "INSERT INTO comments (id, post_id, user_id, body, created_at, deleted_at) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING",
        [id, postId, author, body, `${dayDate(offset)}T18:00:00.000Z`, null],
      );
      await execute(
        "INSERT INTO point_transactions (id, user_id, kind, ref_type, ref_id, points, created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
        [`pts_${id}`, author, "comment", "comment", id, 2, `${dayDate(offset)}T18:00:00.000Z`],
      );
    }

    const reactionData: Array<[string, string, string, string, number]> = [
      ["reaction_1", "post_1", "bruno", "forca", -2],
      ["reaction_2", "post_1", "carla", "apoio", -2],
      ["reaction_3", "post_2", "ana", "fogo", -1],
      ["reaction_4", "post_3", "diego", "apoio", -3],
      ["reaction_5", "post_5", "ana", "forca", 0],
    ];
    for (const [id, postId, key, kind, offset] of reactionData) {
      const author = userIds[key];
      if (!author) continue;
      await execute(
        "INSERT INTO reactions (id, post_id, user_id, kind, created_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING",
        [id, postId, author, kind, `${dayDate(offset)}T19:00:00.000Z`],
      );
      await execute(
        "INSERT INTO point_transactions (id, user_id, kind, ref_type, ref_id, points, created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
        [`pts_${id}`, author, "reaction", "reaction", id, 1, `${dayDate(offset)}T19:00:00.000Z`],
      );
    }

    const weekStart = startOfWeek(today);
    await execute(
      "INSERT INTO challenges (id, community_id, title, description, kind, metric, habit_slug, target_value, starts_on, ends_on, created_by, created_at, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
      [
        "chg_agua",
        communityId,
        "Cinco dias de hidratação",
        "Registre água em pelo menos cinco dias desta semana. Sem exageros: a meta é constância, não quantidade extrema.",
        "individual",
        "habit_days",
        "agua",
        5,
        weekStart,
        addDays(weekStart, 6),
        uid("ana"),
        now,
        "active",
      ],
    );
    await execute(
      "INSERT INTO challenges (id, community_id, title, description, kind, metric, habit_slug, target_value, starts_on, ends_on, created_by, created_at, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
      [
        "chg_time",
        communityId,
        "Time em movimento",
        "A soma de minutos de movimento da turma nesta semana. Cada pessoa no seu ritmo.",
        "collective",
        "habit_value",
        "movimento",
        600,
        weekStart,
        addDays(weekStart, 6),
        uid("bruno"),
        now,
        "active",
      ],
    );
    for (const [challengeId, keys] of [
      ["chg_agua", ["ana", "bruno", "carla"]],
      ["chg_time", ["ana", "bruno", "carla", "diego", "eva"]],
    ] as const) {
      for (const key of keys) {
        const userId = userIds[key];
        if (!userId) continue;
        await execute(
          "INSERT INTO challenge_participants (id, challenge_id, user_id, joined_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
          [`cp_${challengeId}_${key}`, challengeId, userId, `${weekStart}T12:00:00.000Z`],
        );
      }
    }

    await execute(
      "INSERT INTO laboratory_exams (id, document_id, user_id, lab_name, collected_on, resulted_on, notes, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
      [
        "exam_ana_hemograma",
        null,
        uid("ana"),
        "Laboratório Vida",
        addDays(today, -20),
        addDays(today, -18),
        "Exame de rotina. Dados de demonstração, não são resultado real.",
        "confirmed",
        now,
        now,
      ],
    );
    const results: Array<[string, string, string, number | null, string, string, string]> = [
      ["res_hgb", "Hemoglobina", "14,2", 14.2, "g/dL", "12,0 a 16,0", "confirmed"],
      ["res_leuco", "Leucócitos", "6.200", 6200, "/mm³", "4.000 a 11.000", "confirmed"],
      ["res_plaquetas", "Plaquetas", "250.000", 250000, "/mm³", "150.000 a 450.000", "confirmed"],
    ];
    for (const [id, name, valueText, numeric, unit, reference, status] of results) {
      await execute(
        "INSERT INTO exam_results (id, exam_id, user_id, name, value_text, value_numeric, unit, reference_range, flag, page_ref, extraction_method, validation_status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
        [
          id,
          "exam_ana_hemograma",
          uid("ana"),
          name,
          valueText,
          numeric,
          unit,
          reference,
          null,
          "demo",
          "manual",
          status,
          now,
          now,
        ],
      );
    }

    await execute(
      "INSERT INTO laboratory_exams (id, document_id, user_id, lab_name, collected_on, resulted_on, notes, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
      [
        "exam_bruno_lipidios",
        null,
        uid("bruno"),
        "Laboratório Vida",
        addDays(today, -8),
        null,
        "Aguardando conferência dos valores digitados.",
        "awaiting_review",
        now,
        now,
      ],
    );
    for (const [id, name, valueText, numeric, unit, reference] of [
      ["res_col", "Colesterol total", "182", 182, "mg/dL", "inferior a 190"],
      ["res_hdl", "HDL", "48", 48, "mg/dL", "superior a 40"],
    ] as const) {
      await execute(
        "INSERT INTO exam_results (id, exam_id, user_id, name, value_text, value_numeric, unit, reference_range, flag, page_ref, extraction_method, validation_status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
        [
          id,
          "exam_bruno_lipidios",
          uid("bruno"),
          name,
          valueText,
          numeric,
          unit,
          reference,
          null,
          "demo",
          "manual",
          "pending",
          now,
          now,
        ],
      );
    }

    const vaccines: Array<[string, string, string, string | null, string, string, string]> = [
      ["vac_ana_covid", "ana", "COVID-19", "Pfizer", "Reforço", addDays(today, -120), "UBS Pinheiros"],
      ["vac_bruno_influenza", "bruno", "Influenza", "Butantan", "Dose anual", addDays(today, -60), "Clínica Central"],
      ["vac_carla_hepatite", "carla", "Hepatite B", null, "3ª dose", addDays(today, -400), "UBS Centro"],
    ];
    for (const [id, key, name, manufacturer, dose, appliedOn, location] of vaccines) {
      const userId = userIds[key];
      if (!userId) continue;
      await execute(
        "INSERT INTO vaccine_records (id, user_id, document_id, name, manufacturer, dose_label, applied_on, location, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
        [
          id,
          userId,
          null,
          name,
          manufacturer,
          dose,
          appliedOn,
          location,
          key === "carla" ? "pending" : "confirmed",
          null,
          now,
          now,
        ],
      );
    }

    const achievementData: Array<[string, string, string]> = [
      ["ach_ana_1", "ana", "primeiro_registro"],
      ["ach_ana_2", "ana", "sequencia_7"],
      ["ach_ana_3", "ana", "hidratacao_7"],
      ["ach_bruno_1", "bruno", "primeiro_registro"],
      ["ach_eva_1", "eva", "sequencia_7"],
    ];
    const definitions: Record<string, [string, string]> = {
      primeiro_registro: ["Primeiro passo", "Registrou um hábito pela primeira vez."],
      sequencia_7: ["Sete dias de cuidado", "Manteve uma sequência de sete dias registrando hábitos."],
      hidratacao_7: ["Sete dias de água", "Registrou hidratação em sete dias seguidos."],
    };
    for (const [id, key, code] of achievementData) {
      const userId = userIds[key];
      const definition = definitions[code];
      if (!userId || !definition) continue;
      await execute(
        "INSERT INTO achievements (id, user_id, code, title, description, earned_at) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING",
        [id, userId, code, definition[0], definition[1], `${addDays(today, -2)}T12:00:00.000Z`],
      );
    }

    await execute(
      "INSERT INTO notifications (id, user_id, actor_id, kind, title, body, href, read_at, created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
      [
        "ntf_ana_welcome",
        uid("ana"),
        null,
        "system",
        "Bem-vinda ao Pizza Health",
        "Sua comunidade Mesa de Domingo já está ativa. Comece registrando um hábito.",
        "/inicio",
        null,
        now,
      ],
    );
    await execute(
      "INSERT INTO notifications (id, user_id, actor_id, kind, title, body, href, read_at, created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
      [
        "ntf_ana_comment",
        uid("ana"),
        uid("bruno"),
        "comment",
        "Bruno comentou na sua publicação",
        "Abra a comunidade para responder.",
        "/comunidade/mesa-de-domingo",
        null,
        `${dayDate(-2)}T18:05:00.000Z`,
      ],
    );
    await execute(
      "INSERT INTO notifications (id, user_id, actor_id, kind, title, body, href, read_at, created_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
      [
        "ntf_bruno_welcome",
        uid("bruno"),
        null,
        "system",
        "Bem-vindo ao Pizza Health",
        "Você entrou na Mesa de Domingo. Bora cuidar junto?",
        "/inicio",
        null,
        now,
      ],
    );
  }

  const totalUsers = await query<{ total: unknown }>("SELECT COUNT(*) AS total FROM users");
  console.log(`[seed] concluído. users=${Number(totalUsers[0]?.total ?? 0)}`);
  if (env.SEED_DEMO === "1") {
    console.log("[seed] dados demo criados (não usar em produção)");
  }
  await closeDb();
}

main().catch(async (error) => {
  console.error("[seed] falhou:", error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
