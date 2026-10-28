import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] max-w-2xl flex-col items-start justify-center py-16">
      <p className="text-xs font-bold tracking-[0.18em] text-tomato uppercase">
        Página não encontrada
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Esse cuidado não está aqui.</h1>
      <p className="mt-3 text-ink-soft">
        O endereço pode ter mudado, o convite pode ter expirado ou você não tem
        acesso a este conteúdo.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/inicio"
          className="rounded-full bg-tomato px-5 py-2.5 text-sm font-semibold text-white hover:bg-tomato-deep"
        >
          Ir para o início
        </Link>
        <Link
          href="/comunidade"
          className="rounded-full border border-line-strong bg-surface px-5 py-2.5 text-sm font-semibold hover:bg-surface-soft"
        >
          Comunidades
        </Link>
      </div>
    </div>
  );
}
