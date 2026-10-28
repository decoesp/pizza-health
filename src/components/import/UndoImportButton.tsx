"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UndoImportButton({ importId }: { importId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUndo() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/import/apple-health/undo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: importId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao desfazer.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao desfazer.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleUndo}
        disabled={pending}
        className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-tomato-deep hover:bg-tomato-soft disabled:opacity-60"
      >
        {pending ? "Desfazendo…" : "Desfazer"}
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-tomato-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
