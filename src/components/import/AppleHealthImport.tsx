"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Day = {
  date: string;
  waterMl?: number;
  sleepHours?: number;
  movementMinutes?: number;
  steps?: number;
};

type Summary = {
  startDate: string | null;
  endDate: string | null;
  totalDays: number;
  waterDays: number;
  sleepDays: number;
  movementDays: number;
  stepDays: number;
  recordsSeen: number;
  ignoredRecords: number;
};

type Preview = { id: string; summary: Summary; days: Day[] };

function formatDay(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export function AppleHealthImport({ maxBytes = 52_428_800 }: { maxBytes?: number }) {
  const router = useRouter();
  const maxMb = Math.floor(maxBytes / 1024 / 1024);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    if (!file) {
      setError("Escolha o export.zip do app Saúde.");
      return;
    }
    if (file.size === 0) {
      setError("O arquivo está vazio.");
      return;
    }
    if (file.size > maxBytes) {
      setError(
        `O arquivo tem ${(file.size / 1024 / 1024).toFixed(1)} MB e o limite é ${maxMb} MB. Exporte um período menor ou envie o export.xml já extraído.`,
      );
      return;
    }
    setError(null);
    setResult(null);
    setPreview(null);
    setPending(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 180_000);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/import/apple-health/preview", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao ler o arquivo.");
      setPreview(data as Preview);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") {
        setError(
          "A leitura passou de 3 minutos e foi interrompida. Tente um arquivo menor ou envie só o export.xml.",
        );
      } else {
        setError(
          cause instanceof Error ? cause.message : "Falha ao ler o arquivo.",
        );
      }
    } finally {
      window.clearTimeout(timer);
      setPending(false);
    }
  }

  async function handleApply() {
    if (!preview) return;
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/import/apple-health/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: preview.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao importar.");
      setResult({ imported: Number(data.imported ?? 0), skipped: Number(data.skipped ?? 0) });
      setPreview(null);
      setFile(null);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao importar.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="rounded-xl border border-line bg-surface-soft p-4 text-sm text-ink-soft">
        <p className="font-semibold">Como exportar do iPhone</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
          <li>Abra o app Saúde e toque na sua foto no canto superior direito.</li>
          <li>Toque em “Exportar Todos os Dados de Saúde”.</li>
          <li>Envie o arquivo <code className="font-mono">export.zip</code> abaixo.</li>
        </ol>
        <p className="mt-2 text-xs text-muted">
          Importamos apenas água, sono, movimento e passos dos últimos 12 meses.
          Exames, diagnósticos, peso e outros dados clínicos ficam de fora.
          Limite de {maxMb} MB por arquivo.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="file"
          accept=".zip,.xml,application/zip,application/xml,text/xml"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPreview(null);
            setResult(null);
            setError(null);
          }}
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-paper-deep file:px-3 file:py-1.5 file:text-xs file:font-semibold"
        />
        <button
          type="button"
          onClick={handlePreview}
          disabled={pending || !file}
          className="rounded-full bg-tomato px-4 py-2.5 text-sm font-semibold text-white hover:bg-tomato-deep disabled:opacity-60"
        >
          {pending && !preview ? "Enviando e analisando…" : "Analisar arquivo"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl border border-tomato/40 bg-tomato-soft px-3.5 py-2.5 text-sm text-tomato-deep">
          {error}
        </p>
      ) : null}

      {result ? (
        <div role="status" className="mt-3 rounded-xl border border-basil/30 bg-basil-soft px-3.5 py-2.5 text-sm text-basil">
          <p className="font-semibold">Importação concluída.</p>
          <p>
            {result.imported} registro{result.imported === 1 ? "" : "s"} criado
            {result.imported === 1 ? "" : "s"}
            {result.skipped > 0
              ? ` · ${result.skipped} dia(s) já tinham registro e foram preservados`
              : ""}
            . Nenhum ponto de ranking foi adicionado por importação.
          </p>
          <p className="mt-1 text-xs">
            Os registros aparecem em{" "}
            <a href="/habitos" className="font-semibold underline">
              Hábitos
            </a>
            .
          </p>
        </div>
      ) : null}

      {preview ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Prévia da importação</h3>
            <p className="text-xs text-muted">
              {preview.summary.startDate && preview.summary.endDate
                ? `${formatDay(preview.summary.startDate)} a ${formatDay(preview.summary.endDate)}`
                : "sem período"}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg bg-paper-deep p-2.5">
              <p className="text-muted">Dias com dados</p>
              <p className="text-base font-semibold">{preview.summary.totalDays}</p>
            </div>
            <div className="rounded-lg bg-paper-deep p-2.5">
              <p className="text-muted">Água</p>
              <p className="text-base font-semibold">{preview.summary.waterDays} dias</p>
            </div>
            <div className="rounded-lg bg-paper-deep p-2.5">
              <p className="text-muted">Sono</p>
              <p className="text-base font-semibold">{preview.summary.sleepDays} dias</p>
            </div>
            <div className="rounded-lg bg-paper-deep p-2.5">
              <p className="text-muted">Movimento</p>
              <p className="text-base font-semibold">{preview.summary.movementDays} dias</p>
            </div>
          </div>
          <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-soft text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Data</th>
                  <th className="px-3 py-2 font-semibold">Água</th>
                  <th className="px-3 py-2 font-semibold">Sono</th>
                  <th className="px-3 py-2 font-semibold">Movimento</th>
                  <th className="px-3 py-2 font-semibold">Passos</th>
                </tr>
              </thead>
              <tbody>
                {preview.days.map((day) => (
                  <tr key={day.date} className="border-t border-line">
                    <td className="px-3 py-2 font-medium">{formatDay(day.date)}</td>
                    <td className="px-3 py-2">{day.waterMl ? `${day.waterMl} ml` : "—"}</td>
                    <td className="px-3 py-2">{day.sleepHours ? `${day.sleepHours} h` : "—"}</td>
                    <td className="px-3 py-2">
                      {day.movementMinutes ? `${day.movementMinutes} min` : "—"}
                    </td>
                    <td className="px-3 py-2">{day.steps ? day.steps.toLocaleString("pt-BR") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            Mostrando os últimos {preview.days.length} dias. Dias que já têm registro
            manual não serão sobrescritos.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={pending}
              className="rounded-full bg-tomato px-4 py-2.5 text-sm font-semibold text-white hover:bg-tomato-deep disabled:opacity-60"
            >
              {pending ? "Importando…" : "Confirmar importação"}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={pending}
              className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:bg-surface-soft"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
