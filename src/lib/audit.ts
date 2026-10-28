import "server-only";
import { execute, newId, nowIso } from "@/lib/db";
import { requestIpHash } from "@/lib/request-context";

export type AuditInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  communityId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

/**
 * Auditoria sem dados clínicos. `metadata` é serializado apenas com valores
 * primitivos e nunca recebe nome de exame, resultado, diagnóstico ou arquivo.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const ipHash = await requestIpHash();
    await execute(
      "INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, community_id, ip_hash, metadata, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [
        newId("aud"),
        input.actorId,
        input.action,
        input.entityType,
        input.entityId ?? null,
        input.communityId ?? null,
        ipHash,
        input.metadata ? JSON.stringify(input.metadata) : null,
        nowIso(),
      ],
    );
  } catch (error) {
    console.error(
      "[audit] falha ao registrar evento",
      error instanceof Error ? error.message : "erro desconhecido",
    );
  }
}
