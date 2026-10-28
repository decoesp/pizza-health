import Link from "next/link";

export function PizzaMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Pizza Health"
    >
      <path
        d="M8 12c10-8 22-8 32 0L24 44 8 12Z"
        fill="#fffaf4"
        stroke="#c2410c"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M13 15h22" stroke="#c2410c" strokeWidth="3" strokeLinecap="round" />
      <circle cx="21" cy="20" r="2.6" fill="#c2410c" />
      <circle cx="28" cy="24" r="2.2" fill="#3f6b4f" />
      <circle cx="23" cy="29" r="2" fill="#b47c1e" />
      <path d="M24 34v6M21 37h6" stroke="#3f6b4f" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/inicio" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5">
      <PizzaMark />
      <span className="leading-none">
        <span className="block font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
          Pizza Health
        </span>
        <span className="mt-0.5 block text-[0.6rem] font-bold tracking-[0.18em] text-tomato uppercase">
          cuidar junto
        </span>
      </span>
    </Link>
  );
}
