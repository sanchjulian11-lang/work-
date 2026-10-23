import { currentActor } from "@/lib/auth";
import { getBusiness, recordSnapshot } from "@/lib/repository";
import { finalSubmission } from "@/lib/domain";
import { submissionPDF } from "@/lib/submission-pdf";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host"))
      return new Response("Cross-origin request denied", { status: 403 });
    const actor = await currentActor();
    if (!actor) return new Response("Authentication required", { status: 401 });
    const s = await getBusiness(actor, (await params).id);
    const snapshot = finalSubmission(actor, s);
    const pdfFormat = new URL(request.url).searchParams.get("format") === "pdf";
    const content = pdfFormat
      ? new Uint8Array(await submissionPDF(s, snapshot))
      : snapshot.content;
    await recordSnapshot(actor, s, snapshot);
    return new Response(content, {
      headers: {
        "Content-Type": pdfFormat
          ? "application/pdf"
          : "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="submission-${s.id}-r${s.revision}.${pdfFormat ? "pdf" : "md"}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(
      "A current broker approval and complete application are required.",
      { status: 403 },
    );
  }
}
