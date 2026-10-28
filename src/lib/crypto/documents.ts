import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { getEnv } from "@/lib/env";

export type EncryptedDocument = {
  data: string;
  iv: string;
  tag: string;
  version: number;
};

const VERSION = 1;
const ALGORITHM = "aes-256-gcm";

function encryptionKey(): Buffer {
  const env = getEnv();
  if (!env.DOCUMENT_ENCRYPTION_KEY) {
    throw new Error(
      "DOCUMENT_ENCRYPTION_KEY não configurada. Gere com `openssl rand -base64 32`.",
    );
  }
  const key = Buffer.from(env.DOCUMENT_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("DOCUMENT_ENCRYPTION_KEY precisa ter 32 bytes em base64.");
  }
  return key;
}

export function encryptBytes(bytes: Uint8Array): EncryptedDocument {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return {
    data: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    version: VERSION,
  };
}

export function decryptBytes(encrypted: EncryptedDocument): Buffer {
  if (encrypted.version !== VERSION) {
    throw new Error("Versão de criptografia de documento não suportada.");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(encrypted.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.data, "base64")),
    decipher.final(),
  ]);
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export type AcceptedFile = {
  mimeType: string;
  extension: string;
};

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function looksLikeCsv(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  if (sample.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample);
  } catch {
    return false;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  if (text.length === 0) return false;
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return /[,;\t]/.test(firstLine) || /\r?\n/.test(text);
}

/**
 * Valida pelo conteúdo, não pelo Content-Type informado no formulário.
 * Formatos ativos (HTML, SVG, executáveis) são recusados.
 */
export function validateUpload(
  bytes: Uint8Array,
  fileName: string,
): { ok: true; file: AcceptedFile } | { ok: false; error: string } {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) {
    return {
      ok: false,
      error: "Formato não aceito. Envie PDF, CSV, XLS, XLSX, JPG ou PNG.",
    };
  }

  if (extension === "pdf" && startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { ok: true, file: { mimeType, extension } };
  }
  if (
    (extension === "png") &&
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return { ok: true, file: { mimeType, extension } };
  }
  if (
    (extension === "jpg" || extension === "jpeg") &&
    startsWith(bytes, [0xff, 0xd8, 0xff])
  ) {
    return { ok: true, file: { mimeType, extension } };
  }
  if (
    extension === "xlsx" &&
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
  ) {
    return { ok: true, file: { mimeType, extension } };
  }
  if (
    extension === "xls" &&
    startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  ) {
    return { ok: true, file: { mimeType, extension } };
  }
  if (extension === "csv" && looksLikeCsv(bytes)) {
    return { ok: true, file: { mimeType, extension } };
  }

  return {
    ok: false,
    error:
      "O conteúdo do arquivo não corresponde à extensão informada. Verifique e envie novamente.",
  };
}

export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "documento";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "-")
    .trim();
  return (cleaned || "documento").slice(0, 160);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPreviewable(mimeType: string): boolean {
  return (
    mimeType === "application/pdf" ||
    mimeType === "image/png" ||
    mimeType === "image/jpeg"
  );
}
