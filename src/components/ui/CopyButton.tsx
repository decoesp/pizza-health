"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";

export function CopyButton({
  value,
  label = "Copiar link",
  copiedLabel = "Copiado!",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass(copied ? "basil" : "secondary", "sm")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
