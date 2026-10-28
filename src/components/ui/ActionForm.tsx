"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/lib/actions/types";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
  hideMessage = false,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  hideMessage?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok && ref.current) ref.current.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      aria-busy={pending}
    >
      {!hideMessage && state?.error ? (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-tomato/40 bg-tomato-soft px-3.5 py-2.5 text-sm text-tomato-deep"
        >
          {state.error}
        </div>
      ) : null}
      {!hideMessage && state?.message ? (
        <div
          role="status"
          className="mb-3 rounded-xl border border-basil/30 bg-basil-soft px-3.5 py-2.5 text-sm text-basil"
        >
          {state.message}
        </div>
      ) : null}
      {!hideMessage && state?.link ? (
        <div className="mb-3 rounded-xl border border-saffron/30 bg-saffron-soft px-3.5 py-2.5 text-sm">
          <p className="font-medium text-ink">
            {state.linkLabel ?? "Link gerado"}
          </p>
          <a
            href={state.link}
            className="mt-1 block break-all font-mono text-xs text-tomato-deep underline"
          >
            {state.link}
          </a>
        </div>
      ) : null}
      {children}
    </form>
  );
}
