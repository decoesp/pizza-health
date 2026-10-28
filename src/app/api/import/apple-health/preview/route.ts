import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { getEnv } from "@/lib/env";
import { parseAppleHealthFile } from "@/lib/import/apple-health";
import { savePreview } from "@/lib/import/apple-health-store";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Entre para importar dados." }, { status: 401 });
  }
  const limit = rateLimit(`apple-import:${user.id}`, 8, 60 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "Muitas importações. Tente novamente mais tarde." },
      { status: 429 },
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Selecione o arquivo export.zip." }, { status: 400 });
    }
    const env = getEnv();
    if (file.size === 0) {
      return Response.json({ error: "Arquivo vazio." }, { status: 400 });
    }
    if (file.size > env.MAX_APPLE_IMPORT_BYTES) {
      return Response.json(
        {
          error: `Arquivo acima do limite de ${Math.round(
            env.MAX_APPLE_IMPORT_BYTES / 1024 / 1024,
          )} MB.`,
        },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = await parseAppleHealthFile(buffer);
    const id = await savePreview(user.id, file.name || "export.zip", preview);
    await recordAudit({
      actorId: user.id,
      action: "apple_health.preview",
      entityType: "apple_health_import",
      entityId: id,
      metadata: { days: preview.summary.totalDays },
    });

    return Response.json(
      {
        id,
        summary: preview.summary,
        days: preview.days.slice(-90),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[apple-health] prévia falhou:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível ler o arquivo do app Saúde.",
      },
      { status: 400 },
    );
  }
}
