import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getImport, applyImport } from "@/lib/import/apple-health-store";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Entre para importar dados." }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return Response.json({ error: "Importação inválida." }, { status: 400 });
    const stored = await getImport(user.id, id);
    if (!stored) {
      return Response.json({ error: "Importação não encontrada." }, { status: 404 });
    }
    const result = await applyImport(user.id, id);
    await recordAudit({
      actorId: user.id,
      action: "apple_health.apply",
      entityType: "apple_health_import",
      entityId: id,
      metadata: { imported: result.imported, skipped: result.skipped },
    });
    revalidatePath("/inicio");
    revalidatePath("/habitos");
    revalidatePath("/perfil/importar");
    return Response.json(
      { ok: true, ...result },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[apple-health] aplicação falhou:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível aplicar a importação.",
      },
      { status: 400 },
    );
  }
}
