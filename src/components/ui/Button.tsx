import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "basil";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-tomato text-white hover:bg-tomato-deep focus-visible:outline-tomato",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-surface-soft",
  soft: "bg-tomato-soft text-tomato-deep hover:bg-[#f7dcd1]",
  ghost: "text-ink-soft hover:bg-paper-deep",
  danger: "bg-[#9c2f22] text-white hover:bg-[#7f251b]",
  basil: "bg-basil text-white hover:bg-[#335a41]",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`${buttonClass(variant, size)} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link
      href={href}
      className={`${buttonClass(variant, size)} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}
