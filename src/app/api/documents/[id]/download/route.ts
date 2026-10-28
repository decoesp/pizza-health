import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewDocument } from "@/lib/authz";
import { getDocument, getDocumentBlob } from "@/lib/data/documents";
import { decryptBytes, isPreviewable } from "@/lib/crypto/documents";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await params;
  const allowed = await canViewDocument(user.id, id);
  if (!allowed) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }
  const document = await getDocument(id);
  const blob = await getDocumentBlob(id);
  if (!document || !blob) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = decryptBytes(blob);
  } catch {
    return NextResponse.json(
      { error: "Não foi possível abrir o documento." },
      { status: 500 },
    );
  }

  const preview = isPreviewable(document.mimeType) && request.nextUrl.searchParams.get("preview") === "1";
  const encodedName = encodeURIComponent(document.fileName);
  await recordAudit({
    actorId: user.id,
    action: preview ? "document.preview" : "document.download",
    entityType: "health_document",
    entityId: id,
    metadata: { shared: document.userId !== user.id, mimeType: document.mimeType },
  });

  const headers = new Headers({
    "Content-Type": document.mimeType,
    "Content-Length": String(bytes.length),
    "Content-Disposition": `${preview ? "inline" : "attachment"}; filename*=UTF-8''${encodedName}`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
  });
  return new NextResponse(new Uint8Array(bytes), { status: 200, headers });
}
