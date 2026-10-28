import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { dbMode } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = performance.now();
  try {
    await query("SELECT 1 AS ok");
    return NextResponse.json({
      status: "ok",
      database: dbMode(),
      latencyMs: Math.round(performance.now() - started),
      at: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "unavailable", database: dbMode() },
      { status: 503 },
    );
  }
}
