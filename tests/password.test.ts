import "./setup-env";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateToken,
  hashPassword,
  hashToken,
  passwordProblems,
  verifyPassword,
} from "../src/lib/auth/password";

describe("senhas e tokens", () => {
  it("gera hash scrypt e verifica a senha correta", async () => {
    const hash = await hashPassword("uma-senha-forte-123");
    assert.ok(hash.startsWith("scrypt$"));
    assert.equal(await verifyPassword("uma-senha-forte-123", hash), true);
  });

  it("rejeita senha incorreta e hash inválido", async () => {
    const hash = await hashPassword("uma-senha-forte-123");
    assert.equal(await verifyPassword("outra-senha-123", hash), false);
    assert.equal(await verifyPassword("uma-senha-forte-123", "lixo"), false);
  });

  it("gera tokens diferentes e hashes estáveis", () => {
    const a = generateToken();
    const b = generateToken();
    assert.notEqual(a, b);
    assert.equal(hashToken(a), hashToken(a));
    assert.notEqual(hashToken(a), hashToken(b));
    assert.equal(hashToken(a).length, 64);
  });

  it("explica requisitos de senha", () => {
    const problems = passwordProblems("curta");
    assert.ok(problems.includes("Use pelo menos 10 caracteres."));
    assert.ok(problems.includes("Inclua pelo menos um número."));
    assert.deepEqual(passwordProblems("senha-boa-123"), []);
  });
});
