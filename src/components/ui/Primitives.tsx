import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div" | "aside";
}) {
  return (
    <Tag
      className={`rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(36,31,27,0.05)] ${className}`}
    >
      {children}
    </Tag>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function SectionHeader({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {icon ? (
            <span className="text-tomato">
              <Icon name={icon} size={19} />
            </span>
          ) : null}
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[0.68rem] font-bold tracking-[0.16em] text-tomato uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "tomato" | "basil" | "saffron" | "sky" | "plum";
}) {
  const tones = {
    neutral: "bg-paper-deep text-ink-soft",
    tomato: "bg-tomato-soft text-tomato-deep",
    basil: "bg-basil-soft text-basil",
    saffron: "bg-saffron-soft text-saffron",
    sky: "bg-sky-soft text-sky",
    plum: "bg-plum-soft text-plum",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  color,
  size = 40,
  className = "",
}: {
  name: string;
  color: string;
  size?: number;
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "P";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: Math.max(12, size * 0.4),
      }}
    >
      {initial}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "tomato",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: IconName;
  tone?: "tomato" | "basil" | "saffron" | "sky" | "plum";
}) {
  const tones = {
    tomato: "bg-tomato-soft text-tomato-deep",
    basil: "bg-basil-soft text-basil",
    saffron: "bg-saffron-soft text-saffron",
    sky: "bg-sky-soft text-sky",
    plum: "bg-plum-soft text-plum",
  };
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-muted">{label}</p>
        {icon ? (
          <span className={`rounded-full p-1.5 ${tones[tone]}`}>
            <Icon name={icon} size={15} />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  tone = "tomato",
  label,
}: {
  value: number;
  max: number;
  tone?: "tomato" | "basil" | "saffron" | "sky";
  label?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const tones = {
    tomato: "bg-tomato",
    basil: "bg-basil",
    saffron: "bg-saffron",
    sky: "bg-sky",
  };
  return (
    <div>
      {label ? (
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>{label}</span>
          <span>{Math.round(percent)}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || "Progresso"}
        className="h-2 overflow-hidden rounded-full bg-paper-deep"
      >
        <div
          className={`h-full rounded-full ${tones[tone]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon = "spark",
  action,
}: {
  title: string;
  description: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface-soft p-8 text-center">
      <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-tomato-soft text-tomato">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "warning" | "error";
}) {
  const tones = {
    info: "border-sky/30 bg-sky-soft text-[#2f4e7d]",
    success: "border-basil/30 bg-basil-soft text-basil",
    warning: "border-saffron/30 bg-saffron-soft text-[#7e5512]",
    error: "border-tomato/40 bg-tomato-soft text-tomato-deep",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-2.5 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-ink-soft">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-tomato-deep">{error}</p> : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-tomato focus:outline-none focus:ring-2 focus:ring-tomato/20";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: ComponentProps<"textarea">) {
  return <textarea className={`${CONTROL} min-h-24 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${CONTROL} ${className}`} {...props} />;
}

export function Checkbox({
  label,
  description,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: string; description?: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-soft p-3 ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#c2410c]"
        {...props}
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function Divider() {
  return <hr className="border-line" />;
}

export function Breadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Trilha de navegação" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-tomato">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink-soft">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
