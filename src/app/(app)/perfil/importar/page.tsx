import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listImports } from "@/lib/import/apple-health-store";
import { Card, Notice, PageHeader } from "@/components/ui/Primitives";
import { AppleHealthImport } from "@/components/import/AppleHealthImport";
import { DocumentUploadForm } from "@/components/import/DocumentUploadForm";
import { UndoImportButton } from "@/components/import/UndoImportButton";
import { formatDateTime, todayIso } from "@/lib/domain/dates";
import { getEnv } from "@/lib/env";
import { formatBytes } from "@/lib/crypto/documents";

export const metadata: Metadata = { title: "Importar e enviar arquivos" };
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
  const env = getEnv();
  const maxMb = Math.floor(env.MAX_APPLE_IMPORT_BYTES / 1024 / 1024);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Seus dados"
        title="Importar e enviar arquivos"
        description="Traga água, sono, movimento e passos do Apple Saúde ou guarde laudos e outros documentos na sua central privada. Você revisa antes de confirmar."
        action={
          <Link href="/exames" className="text-sm font-semibold text-tomato hover:underline">
            Ver documentos
          </Link>
        }
      />

      <div className="space-y-6">
        <div id="apple-saude" className="scroll-mt-24">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Exportação do Apple Saúde</h2>
            <p className="mt-1 text-xs text-muted">
              Arquivos <code className="font-mono">export.xml</code> ou{" "}
              <code className="font-mono">export.zip</code>, até {maxMb} MB.
            </p>
            <div className="mt-3">
              <AppleHealthImport maxBytes={env.MAX_APPLE_IMPORT_BYTES} />
            </div>
          </Card>
        </div>

        <Notice tone="info">
          O arquivo do Apple Saúde é processado no servidor apenas para gerar a
          prévia. Não guardamos o XML bruto nem dados clínicos; depois de aplicar,
          mantemos só os registros diários dos quatro hábitos. Importações não geram
          pontos de ranking.
        </Notice>

        <div id="documentos" className="scroll-mt-24">
          <Card className="p-5">
            <h2 className="text-base font-semibold">Laudos e outros documentos</h2>
            <p className="mt-1 text-xs text-muted">
              Sangue, imagem, vacina, receita: envie o PDF ou a foto. O original fica
              criptografado e você decide se compartilha com alguma comunidade.
            </p>
            <div className="mt-3">
              <DocumentUploadForm
                maxLabel={formatBytes(env.MAX_UPLOAD_BYTES)}
                today={todayIso()}
              />
            </div>
          </Card>
        </div>

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
