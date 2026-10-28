"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] erro de renderização", error.digest ?? "");
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] max-w-2xl flex-col items-start justify-center py-16">
      <p className="text-xs font-bold tracking-[0.18em] text-tomato uppercase">
        Algo saiu do ritmo
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Não foi possível abrir esta página.</h1>
      <p className="mt-3 text-ink-soft">
        Tente novamente. Se o problema continuar, avise quem administra a instância.
        Nenhum dado clínico é exibido nesta mensagem.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-tomato px-5 py-2.5 text-sm font-semibold text-white hover:bg-tomato-deep"
      >
        Tentar de novo
      </button>
    </div>
  );
}
