import "./setup-env";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  currentStreak,
  daysBetween,
  lastNDays,
  startOfMonth,
  startOfWeek,
} from "../src/lib/domain/dates";

describe("datas", () => {
  it("soma dias atravessando mês e ano", () => {
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(addDays("2028-03-01", -1), "2028-02-29");
  });

  it("calcula diferença em dias", () => {
    assert.equal(daysBetween("2026-10-01", "2026-10-27"), 26);
    assert.equal(daysBetween("2026-10-27", "2026-10-01"), -26);
  });

  it("começa a semana na segunda-feira", () => {
    assert.equal(startOfWeek("2026-10-27"), "2026-10-26");
    assert.equal(startOfWeek("2026-10-25"), "2026-10-19");
    assert.equal(startOfWeek("2026-10-26"), "2026-10-26");
  });

  it("começa o mês no dia 1", () => {
    assert.equal(startOfMonth("2026-10-27"), "2026-10-01");
  });

  it("gera os últimos N dias em ordem crescente", () => {
    assert.deepEqual(lastNDays(3, "2026-10-27"), [
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
    ]);
  });

  it("conta sequência terminando hoje", () => {
    assert.equal(currentStreak(["2026-10-25", "2026-10-26", "2026-10-27"], "2026-10-27"), 3);
  });

  it("conta sequência terminando ontem quando hoje ainda não foi registrado", () => {
    assert.equal(currentStreak(["2026-10-24", "2026-10-25", "2026-10-26"], "2026-10-27"), 3);
  });

  it("quebra a sequência em um dia sem registro", () => {
    assert.equal(
      currentStreak(["2026-10-22", "2026-10-23", "2026-10-26", "2026-10-27"], "2026-10-27"),
      2,
    );
  });

  it("ignora datas futuras e duplicadas", () => {
    assert.equal(currentStreak(["2026-10-27", "2026-10-27", "2026-10-28"], "2026-10-27"), 1);
  });
});
