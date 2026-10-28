"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";

export function PasskeyManager({ count }: { count: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setError(null);
    setMessage(null);
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setError("Este navegador não oferece suporte a passkeys.");
      return;
    }
    setPending(true);
    try {
      const optionsResponse = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      });
      const options = await optionsResponse.json();
      if (!optionsResponse.ok) {
        throw new Error(options.error ?? "Não foi possível iniciar o cadastro.");
      }
      const response = await startRegistration({ optionsJSON: options });
      const verifyResponse = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response, name }),
      });
      const result = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(result.error ?? "Não foi possível validar a passkey.");
      }
      setMessage("Passkey cadastrada. Você já pode usá-la para entrar.");
      setName("");
      router.refresh();
    } catch (cause) {
      const code = cause instanceof Error ? cause.name : "";
      if (code === "NotAllowedError" || code === "AbortError") {
        setError("Cadastro cancelado. Tente novamente quando quiser.");
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível cadastrar a passkey.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="mt-1 text-xs text-muted">
        Passkeys usam Face ID, Touch ID, Windows Hello ou chave de segurança.
        Elas substituem a senha e não saem do seu dispositivo.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="passkey-name" className="sr-only">
          Nome da passkey
        </label>
        <input
          id="passkey-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          placeholder="Ex.: MacBook da Ana"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-tomato"
        />
        <button
          type="button"
          onClick={handleRegister}
          disabled={pending || count >= 10}
          className="rounded-full bg-tomato px-4 py-2.5 text-sm font-semibold text-white hover:bg-tomato-deep disabled:opacity-60"
        >
          {pending ? "Aguardando dispositivo…" : "Cadastrar passkey"}
        </button>
      </div>
      {count >= 10 ? (
        <p className="mt-2 text-xs text-muted">Limite de 10 passkeys atingido.</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-tomato-deep">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-2 text-xs text-basil">
          {message}
        </p>
      ) : null}
    </div>
  );
}
