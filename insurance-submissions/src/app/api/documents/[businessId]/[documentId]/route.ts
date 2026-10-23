import { currentActor, isDemo, serviceClient } from "@/lib/auth";
import { getBusiness, recordDocumentAccess } from "@/lib/repository";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; documentId: string }> },
) {
  try {
    const actor = await currentActor();
    if (!actor) return new Response("Authentication required", { status: 401 });
    const { businessId, documentId } = await params;
    const s = await getBusiness(actor, businessId);
    const d = s.documents.find((d) => d.id === documentId);
    if (!d || isDemo())
      return new Response("Document not found", { status: 404 });
    await recordDocumentAccess(actor, s, documentId);
    const { data, error } = await serviceClient()
      .storage.from("client-documents")
      .createSignedUrl(d.path, 60, { download: d.name });
    if (error || !data) throw new Error("Unavailable");
    return Response.redirect(data.signedUrl, 303);
  } catch {
    return new Response("Document unavailable or access denied", {
      status: 403,
    });
  }
}
