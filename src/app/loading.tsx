export default function Loading() {
  return (
    <div className="container-page py-10" aria-busy="true" aria-live="polite">
      <div className="h-4 w-28 animate-pulse rounded-full bg-paper-deep" />
      <div className="mt-3 h-8 w-80 max-w-full animate-pulse rounded-lg bg-paper-deep" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl bg-surface-soft" />
        ))}
      </div>
      <div className="mt-6 h-64 animate-pulse rounded-2xl bg-surface-soft" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
