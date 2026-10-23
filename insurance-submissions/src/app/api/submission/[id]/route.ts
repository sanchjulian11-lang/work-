import { currentActor } from "@/lib/auth";
import { getBusiness, recordSnapshot } from "@/lib/repository";
import { finalSubmission } from "@/lib/domain";
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
    await recordSnapshot(actor, s, snapshot);
    return new Response(snapshot.content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="submission-${s.id}-r${s.revision}.md"`,
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
