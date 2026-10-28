import "./setup-env";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  POINTS,
  pointsToNextTier,
  rankWindow,
  sortRanking,
  type RankRow,
} from "../src/lib/domain/scoring";

const rows: RankRow[] = [
  { userId: "a", name: "Ana", avatarColor: "#000", points: 30, entries: 3 },
  { userId: "b", name: "Bruno", avatarColor: "#000", points: 50, entries: 5 },
  { userId: "c", name: "Carla", avatarColor: "#000", points: 30, entries: 3 },
];

describe("pontuação e ranking", () => {
  it("ordena por pontos e desempata por nome", () => {
    assert.deepEqual(sortRanking(rows).map((row) => row.name), ["Bruno", "Ana", "Carla"]);
  });

  it("não muta a lista original", () => {
    const copy = [...rows];
    sortRanking(rows);
    assert.deepEqual(rows, copy);
  });

  it("calcula a janela semanal a partir de segunda", () => {
    const window = rankWindow("week", "2026-10-27");
    assert.equal(window.start, "2026-10-26");
    assert.equal(window.label, "Esta semana");
  });

  it("calcula a janela mensal", () => {
    const window = rankWindow("month", "2026-10-27");
    assert.equal(window.start, "2026-10-01");
    assert.equal(window.label, "Este mês");
  });

  it("não concede pontos sociais acima do teto diário", () => {
    assert.equal(POINTS.socialDailyCap, 10);
    assert.ok(POINTS.comment + POINTS.reaction <= POINTS.socialDailyCap);
  });

  it("calcula o próximo marco de pontos", () => {
    assert.deepEqual(pointsToNextTier(0), { next: 50, missing: 50 });
    assert.deepEqual(pointsToNextTier(120), { next: 250, missing: 130 });
    assert.deepEqual(pointsToNextTier(900), { next: 900, missing: 0 });
  });
});
