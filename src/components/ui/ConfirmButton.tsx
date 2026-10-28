"use client";

import { buttonClass } from "@/components/ui/Button";

export function ConfirmButton({
  children,
  message,
  variant = "ghost",
  size = "sm",
  className = "",
}: {
  children: React.ReactNode;
  message: string;
  variant?: "primary" | "secondary" | "soft" | "ghost" | "danger" | "basil";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={`${buttonClass(variant, size)} ${className}`}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
