import "server-only";
import { StringDecoder } from "node:string_decoder";
import { Readable } from "node:stream";
import { parser as createParser } from "sax";
import { fromBufferPromise } from "yauzl";
import { addDays, todayIso } from "@/lib/domain/dates";

export type AppleHealthDay = {
  date: string;
  waterMl?: number;
  sleepHours?: number;
  movementMinutes?: number;
  steps?: number;
};

export type AppleHealthSummary = {
  startDate: string | null;
  endDate: string | null;
  totalDays: number;
  waterDays: number;
  sleepDays: number;
  movementDays: number;
  stepDays: number;
  recordsSeen: number;
  ignoredRecords: number;
};

export type AppleHealthPreview = {
  days: AppleHealthDay[];
  summary: AppleHealthSummary;
};

const MAX_XML_BYTES = 300 * 1024 * 1024;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Attributes = Record<string, string>;

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAppleDate(value: string): number | null {
  const match =
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\s*([+-])(\d{2})(\d{2}))?$/.exec(
      value.trim(),
    );
  if (!match) return null;
  const [, date, time, sign, hours, minutes] = match;
  const offset = sign ? `${sign}${hours}:${minutes}` : "Z";
  const parsed = Date.parse(`${date}T${time}${offset}`);
  return Number.isFinite(parsed) ? parsed : null;
}

function localDate(value: string): string | null {
  const date = value.slice(0, 10);
  return DATE_RE.test(date) ? date : null;
}

function toMl(value: number, unit: string): number | null {
  switch (unit.toLowerCase()) {
    case "ml":
      return value;
    case "l":
      return value * 1000;
    case "fl_oz_us":
      return value * 29.5735;
    case "fl_oz_imp":
      return value * 28.4131;
    case "cup_us":
      return value * 236.588;
    default:
      return null;
  }
}

function toMinutes(value: number, unit: string): number | null {
  switch (unit.toLowerCase()) {
    case "min":
      return value;
    case "hr":
    case "h":
      return value * 60;
    case "sec":
    case "s":
      return value / 60;
    default:
      return null;
  }
}

function mergeIntervals(intervals: Array<[number, number]>): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let currentStart = sorted[0]?.[0] ?? 0;
  let currentEnd = sorted[0]?.[1] ?? 0;
  for (const [start, end] of sorted.slice(1)) {
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
    } else {
      total += Math.max(0, currentEnd - currentStart);
      currentStart = start;
      currentEnd = end;
    }
  }
  total += Math.max(0, currentEnd - currentStart);
  return total;
}

type Accumulator = {
  water: Map<string, number>;
  steps: Map<string, number>;
  exercise: Map<string, number>;
  workout: Map<string, number>;
  sleep: Map<string, Array<[number, number]>>;
  minDate: string;
  maxDate: string;
  recordsSeen: number;
  ignoredRecords: number;
};

function acceptDate(date: string | null, acc: Accumulator): date is string {
  return Boolean(date && date >= acc.minDate && date <= acc.maxDate);
}

function handleRecord(attributes: Attributes, acc: Accumulator): void {
  const type = attributes.type ?? "";
  const startDate = attributes.startdate ?? "";
  const value = numberValue(attributes.value);
  const unit = attributes.unit ?? "";

  if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
    if (!attributes.value?.startsWith("HKCategoryValueSleepAnalysisAsleep")) return;
    const date = localDate(attributes.enddate ?? startDate);
    if (!acceptDate(date, acc)) return;
    const start = parseAppleDate(startDate);
    const end = parseAppleDate(attributes.enddate ?? "");
    if (start === null || end === null || end <= start) return;
    const list = acc.sleep.get(date) ?? [];
    list.push([start, end]);
    acc.sleep.set(date, list);
    acc.recordsSeen += 1;
    return;
  }

  if (value === null) return;
  const date = localDate(startDate);
  if (!acceptDate(date, acc)) {
    acc.ignoredRecords += 1;
    return;
  }

  if (type === "HKQuantityTypeIdentifierDietaryWater") {
    const ml = toMl(value, unit);
    if (ml === null || ml <= 0) {
      acc.ignoredRecords += 1;
      return;
    }
    acc.water.set(date, (acc.water.get(date) ?? 0) + ml);
    acc.recordsSeen += 1;
    return;
  }

  if (type === "HKQuantityTypeIdentifierStepCount") {
    if (value <= 0) return;
    acc.steps.set(date, (acc.steps.get(date) ?? 0) + value);
    acc.recordsSeen += 1;
    return;
  }

  if (type === "HKQuantityTypeIdentifierAppleExerciseTime") {
    const minutes = toMinutes(value, unit);
    if (minutes === null || minutes <= 0) {
      acc.ignoredRecords += 1;
      return;
    }
    acc.exercise.set(date, (acc.exercise.get(date) ?? 0) + minutes);
    acc.recordsSeen += 1;
  }
}

function handleWorkout(attributes: Attributes, acc: Accumulator): void {
  const date = localDate(attributes.startdate ?? "");
  if (!acceptDate(date, acc)) {
    acc.ignoredRecords += 1;
    return;
  }
  const duration = numberValue(attributes.duration);
  if (duration === null) return;
  const minutes = toMinutes(duration, attributes.durationunit ?? "min");
  if (minutes === null || minutes <= 0) {
    acc.ignoredRecords += 1;
    return;
  }
  acc.workout.set(date, (acc.workout.get(date) ?? 0) + minutes);
  acc.recordsSeen += 1;
}

async function parseXmlStream(stream: Readable, acc: Accumulator): Promise<void> {
  const parser = createParser(false, { lowercase: true });
  const decoder = new StringDecoder("utf8");
  let settled = false;

  return new Promise((resolve, reject) => {
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    parser.onopentag = (node) => {
      const attributes = (node.attributes ?? {}) as Attributes;
      if (node.name === "record") handleRecord(attributes, acc);
      else if (node.name === "workout") handleWorkout(attributes, acc);
    };
    parser.onerror = (error) => {
      fail(error instanceof Error ? error : new Error("XML inválido."));
    };
    parser.onend = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    stream.on("data", (chunk: Buffer) => {
      if (settled) return;
      parser.write(decoder.write(chunk));
    });
    stream.on("end", () => {
      if (settled) return;
      parser.write(decoder.end());
      parser.close();
    });
    stream.on("error", (error) => {
      fail(error instanceof Error ? error : new Error("Falha ao ler o arquivo."));
    });
  });
}

async function readZipStream(buffer: Buffer): Promise<Readable> {
  const zip = await fromBufferPromise(buffer, { lazyEntries: true, validateEntrySizes: true });
  for await (const entry of zip.eachEntry()) {
    if (!/export\.xml$/i.test(entry.fileName)) continue;
    if (entry.uncompressedSize > MAX_XML_BYTES) {
      zip.close();
      throw new Error("O export.xml é grande demais para importar.");
    }
    return await zip.openReadStreamPromise(entry);
  }
  zip.close();
  throw new Error("O ZIP não contém apple_health_export/export.xml.");
}

function isZip(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

function isXml(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 4096).toString("utf8");
  return /<HealthData[\s>]/i.test(head);
}

export async function parseAppleHealthFile(
  buffer: Buffer,
): Promise<AppleHealthPreview> {
  if (buffer.length === 0) throw new Error("Arquivo vazio.");
  let stream: Readable;
  if (isZip(buffer)) {
    stream = await readZipStream(buffer);
  } else if (isXml(buffer)) {
    stream = Readable.from([buffer]);
  } else {
    throw new Error("Envie o export.zip ou o export.xml do app Saúde.");
  }

  const today = todayIso();
  const acc: Accumulator = {
    water: new Map(),
    steps: new Map(),
    exercise: new Map(),
    workout: new Map(),
    sleep: new Map(),
    minDate: addDays(today, -365),
    maxDate: today,
    recordsSeen: 0,
    ignoredRecords: 0,
  };
  await parseXmlStream(stream, acc);

  const dates = new Set<string>([
    ...acc.water.keys(),
    ...acc.steps.keys(),
    ...acc.exercise.keys(),
    ...acc.workout.keys(),
    ...acc.sleep.keys(),
  ]);
  const days: AppleHealthDay[] = [];
  for (const date of [...dates].sort()) {
    const water = acc.water.get(date);
    const sleepMs = acc.sleep.has(date)
      ? mergeIntervals(acc.sleep.get(date) ?? [])
      : 0;
    const exercise = acc.exercise.get(date) ?? 0;
    const workout = acc.workout.get(date) ?? 0;
    const movement = Math.max(exercise, workout);
    const steps = acc.steps.get(date);
    const day: AppleHealthDay = { date };
    if (water && water > 0) day.waterMl = Math.round(water);
    if (sleepMs > 0) {
      day.sleepHours = Math.round(Math.min(24, sleepMs / 3_600_000) * 10) / 10;
    }
    if (movement > 0) day.movementMinutes = Math.round(movement);
    if (steps && steps > 0) day.steps = Math.round(steps);
    if (
      day.waterMl !== undefined ||
      day.sleepHours !== undefined ||
      day.movementMinutes !== undefined ||
      day.steps !== undefined
    ) {
      days.push(day);
    }
  }

  if (days.length === 0) {
    throw new Error(
      "Nenhum registro compatível encontrado. O arquivo precisa ter água, sono, exercício ou passos.",
    );
  }

  const summary: AppleHealthSummary = {
    startDate: days[0]?.date ?? null,
    endDate: days[days.length - 1]?.date ?? null,
    totalDays: days.length,
    waterDays: days.filter((day) => day.waterMl !== undefined).length,
    sleepDays: days.filter((day) => day.sleepHours !== undefined).length,
    movementDays: days.filter((day) => day.movementMinutes !== undefined).length,
    stepDays: days.filter((day) => day.steps !== undefined).length,
    recordsSeen: acc.recordsSeen,
    ignoredRecords: acc.ignoredRecords,
  };

  return { days, summary };
}
