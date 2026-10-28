import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listImports } from "@/lib/import/apple-health-store";
import { Card, Notice, PageHeader } from "@/components/ui/Primitives";
import { AppleHealthImport } from "@/components/import/AppleHealthImport";
import { UndoImportButton } from "@/components/import/UndoImportButton";
import { formatDateTime } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Importar Apple Saúde" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  preview: "prévia",
  applied: "aplicada",
  undone: "desfeita",
  failed: "falhou",
};

export default async function ImportPage() {
  const user = await requireUser("/perfil/importar");
  const imports = await listImports(user.id);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Seus dados"
        title="Importar do Apple Saúde"
        description="Traga água, sono, movimento e passos do iPhone para o seu diário. Você revisa antes de confirmar."
        action={
          <Link href="/habitos" className="text-sm font-semibold text-tomato hover:underline">
            Ver hábitos
          </Link>
        }
      />

      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Enviar exportação</h2>
          <div className="mt-3">
            <AppleHealthImport />
          </div>
        </Card>

        <Notice tone="info">
          O arquivo é processado no servidor apenas para gerar a prévia. Não
          guardamos o XML bruto nem dados clínicos; depois de aplicar, mantemos só
          os registros diários dos quatro hábitos. Importações não geram pontos de
          ranking.
        </Notice>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Histórico</h2>
          {imports.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nenhuma importação ainda.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {imports.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.filename}{" "}
                      <span className="text-xs font-normal text-muted">
                        · {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      {item.summary.startDate && item.summary.endDate
                        ? `${item.summary.startDate} a ${item.summary.endDate} · `
                        : ""}
                      {item.summary.totalDays} dia(s) ·{" "}
                      {item.summary.imported ?? 0} registro(s) importado(s)
                      {typeof item.summary.skipped === "number" && item.summary.skipped > 0
                        ? ` · ${item.summary.skipped} preservado(s)`
                        : ""}
                    </p>
                    <p className="text-[0.68rem] text-muted">
                      enviada em {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  {item.status === "applied" ? (
                    <UndoImportButton importId={item.id} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
