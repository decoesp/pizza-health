import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { undoImport } from "@/lib/import/apple-health-store";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Entre para gerenciar a importação." }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return Response.json({ error: "Importação inválida." }, { status: 400 });
    const result = await undoImport(user.id, id);
    await recordAudit({
      actorId: user.id,
      action: "apple_health.undo",
      entityType: "apple_health_import",
      entityId: id,
      metadata: { removed: result.removed },
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
      "[apple-health] reversão falhou:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível desfazer a importação.",
      },
      { status: 400 },
    );
  }
}
