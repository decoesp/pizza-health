import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, todayIso } from "../src/lib/domain/dates";
import { parseAppleHealthFile } from "../src/lib/import/apple-health";

function appleDate(date: string, time: string): string {
  return `${date} ${time} -0300`;
}

function xml(records: string[]): Buffer {
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="pt_BR">
  ${records.join("\n  ")}
</HealthData>`,
    "utf8",
  );
}

test("Apple Saúde: agrega água, sono, movimento e passos por dia", async () => {
  const today = todayIso();
  const day = addDays(today, -1);
  const previous = addDays(day, -1);
  const old = addDays(today, -400);

  const preview = await parseAppleHealthFile(
    xml([
      `<Record type="HKQuantityTypeIdentifierDietaryWater" unit="mL" value="250" startDate="${appleDate(day, "08:00:00")}" endDate="${appleDate(day, "08:00:00")}"/>`,
      `<Record type="HKQuantityTypeIdentifierDietaryWater" unit="L" value="0.5" startDate="${appleDate(day, "12:00:00")}" endDate="${appleDate(day, "12:00:00")}"/>`,
      `<Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisInBed" startDate="${appleDate(previous, "22:30:00")}" endDate="${appleDate(day, "07:00:00")}"/>`,
      `<Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepCore" startDate="${appleDate(previous, "23:00:00")}" endDate="${appleDate(day, "07:00:00")}"/>`,
      `<Record type="HKQuantityTypeIdentifierStepCount" unit="count" value="1000" startDate="${appleDate(day, "09:00:00")}" endDate="${appleDate(day, "09:00:00")}"/>`,
      `<Record type="HKQuantityTypeIdentifierStepCount" unit="count" value="2500" startDate="${appleDate(day, "18:00:00")}" endDate="${appleDate(day, "18:00:00")}"/>`,
      `<Record type="HKQuantityTypeIdentifierAppleExerciseTime" unit="min" value="30" startDate="${appleDate(day, "19:00:00")}" endDate="${appleDate(day, "19:00:00")}"/>`,
      `<Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="20" durationUnit="min" startDate="${appleDate(day, "07:00:00")}"/>`,
      `<Record type="HKQuantityTypeIdentifierDietaryWater" unit="mL" value="900" startDate="${appleDate(old, "08:00:00")}" endDate="${appleDate(old, "08:00:00")}"/>`,
      `<Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" value="70" startDate="${appleDate(day, "08:00:00")}" endDate="${appleDate(day, "08:00:00")}"/>`,
    ]),
  );

  assert.equal(preview.days.length, 1);
  const entry = preview.days[0];
  assert.ok(entry);
  assert.equal(entry.date, day);
  assert.equal(entry.waterMl, 750);
  assert.equal(entry.sleepHours, 8);
  assert.equal(entry.movementMinutes, 30);
  assert.equal(entry.steps, 3500);
  assert.equal(preview.summary.totalDays, 1);
  assert.equal(preview.summary.waterDays, 1);
  assert.equal(preview.summary.sleepDays, 1);
  assert.equal(preview.summary.movementDays, 1);
  assert.equal(preview.summary.stepDays, 1);
});

test("Apple Saúde: une segmentos de sono sobrepostos", async () => {
  const day = addDays(todayIso(), -2);
  const preview = await parseAppleHealthFile(
    xml([
      `<Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepCore" startDate="${appleDate(day, "23:00:00")}" endDate="${appleDate(addDays(day, 1), "03:00:00")}"/>`,
      `<Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepDeep" startDate="${appleDate(addDays(day, 1), "02:00:00")}" endDate="${appleDate(addDays(day, 1), "04:00:00")}"/>`,
    ]),
  );
  assert.equal(preview.days[0]?.date, addDays(day, 1));
  assert.equal(preview.days[0]?.sleepHours, 5);
});

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** ZIP mínimo (método "store"), só para exercitar o caminho do export.zip. */
function zip(fileName: string, content: Buffer): Buffer {
  const name = Buffer.from(fileName, "utf8");
  const crc = crc32(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(content.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(content.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const centralOffset = local.length + name.length + content.length;
  const centralSize = 46 + name.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, name, content, central, name, end]);
}

test("Apple Saúde: lê export.zip com export.xml aninhado", async () => {
  const day = addDays(todayIso(), -3);
  const archive = zip(
    "apple_health_export/export.xml",
    xml([
      `<Record type="HKQuantityTypeIdentifierDietaryWater" unit="mL" value="1200" startDate="${appleDate(day, "09:00:00")}" endDate="${appleDate(day, "09:00:00")}"/>`,
    ]),
  );
  const preview = await parseAppleHealthFile(archive);
  assert.equal(preview.days.length, 1);
  assert.equal(preview.days[0]?.date, day);
  assert.equal(preview.days[0]?.waterMl, 1200);
});

test("Apple Saúde: recusa ZIP sem export.xml", async () => {
  await assert.rejects(
    () => parseAppleHealthFile(zip("outros/dados.csv", Buffer.from("a,b\n1,2"))),
    /não contém/,
  );
});

test("Apple Saúde: recusa arquivo sem dados compatíveis", async () => {
  await assert.rejects(
    () =>
      parseAppleHealthFile(
        xml([
          `<Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" value="70" startDate="${appleDate(todayIso(), "08:00:00")}" endDate="${appleDate(todayIso(), "08:00:00")}"/>`,
        ]),
      ),
    /Nenhum registro compatível/,
  );
});
