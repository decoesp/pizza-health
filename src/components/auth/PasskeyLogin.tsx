"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";

export function PasskeyLogin({ next = "/inicio" }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setError("Este navegador não oferece suporte a passkeys.");
      return;
    }
    setPending(true);
    try {
      const optionsResponse = await fetch("/api/auth/passkey/login/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const options = await optionsResponse.json();
      if (!optionsResponse.ok) {
        throw new Error(options.error ?? "Não foi possível iniciar o login.");
      }

      const response = await startAuthentication({ optionsJSON: options });
      const verifyResponse = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, next }),
      });
      const result = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(result.error ?? "Passkey inválida.");
      }
      window.location.assign(result.redirect ?? "/inicio");
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : "";
      if (name === "NotAllowedError" || name === "AbortError") {
        setError("Operação cancelada. Tente novamente quando quiser.");
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível entrar com passkey.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-line bg-surface-soft p-4">
      <p className="text-sm font-semibold">Entrar com passkey</p>
      <p className="mt-1 text-xs text-muted">
        Use Face ID, Touch ID, Windows Hello ou uma chave de segurança. O e-mail
        ajuda a encontrar suas passkeys; deixe em branco para escolher no dispositivo.
      </p>
      <label htmlFor="passkey-email" className="mt-3 block text-xs font-semibold text-ink-soft">
        E-mail (opcional)
      </label>
      <input
        id="passkey-email"
        type="email"
        autoComplete="username webauthn"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="voce@exemplo.com"
        className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-tomato"
      />
      {error ? (
        <p role="alert" className="mt-2 text-xs text-tomato-deep">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleLogin}
        disabled={pending}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper-deep disabled:opacity-60"
      >
        <span aria-hidden>🔐</span>
        {pending ? "Aguardando dispositivo…" : "Entrar com passkey"}
      </button>
    </div>
  );
}
