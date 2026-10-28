"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/Button";

export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
  variant = "primary",
  size = "md",
  className = "",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "soft" | "ghost" | "danger" | "basil";
  size?: "sm" | "md" | "lg";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`${buttonClass(variant, size)} ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
