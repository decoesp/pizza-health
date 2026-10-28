/**
 * Camada de persistência portátil.
 *
 * O PizzaSQL fala o protocolo do Postgres, mas aceita apenas um subconjunto
 * próximo do SQLite: TEXT/INTEGER/REAL, `?` não é placeholder nativo, não há
 * `bytea`, `timestamptz`, `now()`, `ILIKE` nem `ON DELETE CASCADE`.
 *
 * Por isso todo o SQL da aplicação usa um subconjunto comum aos dois motores,
 * com `?` como placeholder. No modo remoto os placeholders são reescritos para
 * `$1..$n`. Datas são TEXT ISO-8601 geradas pela aplicação, nunca pelo banco.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool, type PoolClient } from "pg";
import { getEnv } from "@/lib/env";

export type DbParam = string | number | null;
export type DbRow = Record<string, unknown>;

export type DbExecutor = {
  query<T extends DbRow = DbRow>(sql: string, params?: DbParam[]): Promise<T[]>;
  execute(sql: string, params?: DbParam[]): Promise<{ rowsAffected: number }>;
};

type LocalState = {
  db: DatabaseSync;
  statements: Map<string, ReturnType<DatabaseSync["prepare"]>>;
};

let localState: LocalState | null = null;
let remotePool: Pool | null = null;

export function dbMode(): "remote" | "local" {
  const env = getEnv();
  return env.DB_MODE === "remote" && Boolean(env.PIZZA_API_KEY) ? "remote" : "local";
}

function getLocal(): LocalState {
  if (localState) return localState;
  const env = getEnv();
  const file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.LOCAL_DB_PATH);
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA foreign_keys = ON;");
  localState = { db, statements: new Map() };
  return localState;
}

function getRemotePool(): Pool {
  if (remotePool) return remotePool;
  const env = getEnv();
  remotePool = new Pool({
    host: env.PIZZA_DB_HOST,
    port: env.PIZZA_DB_PORT,
    user: "u",
    password: env.PIZZA_API_KEY,
    database: env.PIZZA_DB,
    ssl: false,
    max: env.DATABASE_POOL_MAX,
    min: 1,
    idleTimeoutMillis: 0,
    keepAlive: true,
    connectionTimeoutMillis: 15_000,
    application_name: "pizza-health",
  });
  remotePool.on("error", (error) => {
    console.error("[db] cliente ocioso falhou", error.message);
  });
  // A cota do PizzaSQL é compartilhada. Um pulso periódico mantém a única
  // conexão viva e evita reconectar a cada intervalo ocioso do servidor.
  const keepAlive = setInterval(() => {
    void remotePool?.query("SELECT 1").catch(() => undefined);
  }, 20_000);
  keepAlive.unref();
  return remotePool;
}

function isConnectionQuotaError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "53300"
  );
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * O PizzaSQL limita conexões por organização e a cota é compartilhada entre
 * aplicações. Mantemos uma conexão viva e, se a abertura for recusada por cota,
 * tentamos novamente com espera curta antes de devolver o erro.
 */
async function remoteQuery(sql: string, params: DbParam[]) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await getRemotePool().query(toPostgresPlaceholders(sql), params);
    } catch (error) {
      lastError = error;
      if (!isConnectionQuotaError(error) || attempt === 4) throw error;
      await wait(300 * 3 ** attempt);
    }
  }
  throw lastError;
}

function toPostgresPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export function normalizeRow(row: DbRow): DbRow {
  const clean: DbRow = {};
  for (const [key, value] of Object.entries(row)) {
    clean[key] =
      typeof value === "bigint"
        ? Number(value)
        : value instanceof Date
          ? value.toISOString()
          : value;
  }
  return clean;
}

function localRunner(state: LocalState): DbExecutor {
  return {
    async query<T extends DbRow = DbRow>(sql: string, params: DbParam[] = []) {
      let statement = state.statements.get(sql);
      if (!statement) {
        statement = state.db.prepare(sql);
        state.statements.set(sql, statement);
      }
      return (statement.all(...params) as DbRow[]).map(normalizeRow) as T[];
    },
    async execute(sql: string, params: DbParam[] = []) {
      let statement = state.statements.get(sql);
      if (!statement) {
        statement = state.db.prepare(sql);
        state.statements.set(sql, statement);
      }
      const result = statement.run(...params);
      return { rowsAffected: Number(result.changes) };
    },
  };
}

function clientRunner(client: PoolClient): DbExecutor {
  return {
    async query<T extends DbRow = DbRow>(sql: string, params: DbParam[] = []) {
      const result = await client.query(toPostgresPlaceholders(sql), params);
      return (result.rows as DbRow[]).map(normalizeRow) as T[];
    },
    async execute(sql: string, params: DbParam[] = []) {
      const result = await client.query(toPostgresPlaceholders(sql), params);
      return { rowsAffected: result.rowCount ?? 0 };
    },
  };
}

export async function query<T extends DbRow = DbRow>(
  sql: string,
  params: DbParam[] = [],
): Promise<T[]> {
  if (dbMode() === "local") {
    return localRunner(getLocal()).query<T>(sql, params);
  }
  const result = await remoteQuery(sql, params);
  return (result.rows as DbRow[]).map(normalizeRow) as T[];
}

export async function queryOne<T extends DbRow = DbRow>(
  sql: string,
  params: DbParam[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params: DbParam[] = [],
): Promise<{ rowsAffected: number }> {
  if (dbMode() === "local") {
    return localRunner(getLocal()).execute(sql, params);
  }
  const result = await remoteQuery(sql, params);
  return { rowsAffected: result.rowCount ?? 0 };
}

export async function executeMany(statements: string[]): Promise<void> {
  for (const statement of statements) {
    await execute(statement);
  }
}

export async function withTransaction<T>(
  fn: (tx: DbExecutor) => Promise<T>,
): Promise<T> {
  if (dbMode() === "local") {
    const state = getLocal();
    const runner = localRunner(state);
    state.db.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn(runner);
      state.db.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        state.db.exec("ROLLBACK");
      } catch {
        // A transação pode já ter sido encerrada pelo SQLite.
      }
      throw error;
    }
  }

  let lastError: unknown;
  let client: PoolClient | null = null;
  for (let attempt = 0; attempt < 5 && !client; attempt += 1) {
    try {
      client = await getRemotePool().connect();
    } catch (error) {
      lastError = error;
      if (!isConnectionQuotaError(error) || attempt === 4) throw error;
      await wait(300 * 3 ** attempt);
    }
  }
  if (!client) throw lastError;
  try {
    await client.query("BEGIN");
    const result = await fn(clientRunner(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Mantém o erro original.
    }
    throw error;
  } finally {
    client.release();
  }
}

export function toInt(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function toFloat(value: unknown, fallback = 0): number {
  return toInt(value, fallback);
}

export function toBool(value: unknown): boolean {
  return toInt(value) === 1;
}

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(",");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export async function closeDb(): Promise<void> {
  if (remotePool) {
    await remotePool.end();
    remotePool = null;
  }
  if (localState) {
    localState.db.close();
    localState = null;
  }
}
