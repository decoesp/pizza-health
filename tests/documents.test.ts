import "./setup-env";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decryptBytes,
  encryptBytes,
  safeFileName,
  sha256Hex,
  validateUpload,
} from "../src/lib/crypto/documents";

const pdf = new TextEncoder().encode("%PDF-1.7\nconteúdo de teste\n%%EOF");
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const xlsx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]);
const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const csv = new TextEncoder().encode("exame,valor,unidade\nHemoglobina,14.2,g/dL\n");

describe("criptografia de documentos", () => {
  it("faz round-trip AES-256-GCM", () => {
    const encrypted = encryptBytes(pdf);
    assert.equal(encrypted.version, 1);
    assert.ok(!encrypted.data.includes("%PDF"));
    assert.ok(decryptBytes(encrypted).toString().includes("%PDF-1.7"));
  });

  it("detecta adulteração", () => {
    const encrypted = encryptBytes(pdf);
    const tampered = { ...encrypted, data: `${encrypted.data.slice(0, -4)}AAAA` };
    assert.throws(() => decryptBytes(tampered));
  });

  it("calcula hash estável", () => {
    assert.equal(sha256Hex(pdf), sha256Hex(pdf));
    assert.equal(sha256Hex(pdf).length, 64);
  });
});

describe("validação de upload", () => {
  it("aceita PDF, PNG, JPEG, XLSX, XLS e CSV válidos", () => {
    assert.equal(validateUpload(pdf, "laudo.pdf").ok, true);
    assert.equal(validateUpload(png, "foto.png").ok, true);
    assert.equal(validateUpload(jpeg, "foto.jpg").ok, true);
    assert.equal(validateUpload(xlsx, "planilha.xlsx").ok, true);
    assert.equal(validateUpload(xls, "planilha.xls").ok, true);
    assert.equal(validateUpload(csv, "resultados.csv").ok, true);
  });

  it("recusa extensão não permitida", () => {
    assert.equal(validateUpload(pdf, "laudo.exe").ok, false);
    assert.equal(validateUpload(pdf, "laudo.svg").ok, false);
    assert.equal(validateUpload(pdf, "laudo.html").ok, false);
  });

  it("recusa conteúdo que não corresponde à extensão", () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    assert.equal(validateUpload(html, "laudo.pdf").ok, false);
    assert.equal(validateUpload(csv, "laudo.png").ok, false);
    assert.equal(validateUpload(new Uint8Array([0, 1, 2, 3]), "dados.csv").ok, false);
  });

  it("sanea nome de arquivo", () => {
    assert.equal(safeFileName("../../etc/passwd"), "passwd");
    assert.equal(safeFileName('laudo<>:"?.pdf'), "laudo-----.pdf");
    assert.equal(safeFileName(""), "documento");
  });
});
