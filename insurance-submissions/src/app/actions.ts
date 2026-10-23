"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  configured,
  currentActor,
  isDemo,
  serviceClient,
  sessionClient,
} from "@/lib/auth";
import {
  getBusiness,
  commit,
  createBusiness,
  clientMembers,
} from "@/lib/repository";
import {
  approve,
  assertAccess,
  attachDraft,
  changed,
  requireBroker,
  saveAnswer,
  verifyAnswer,
} from "@/lib/domain";
import { actionDestination } from "@/lib/navigation";
import { COVERAGE_RULE_VERSION } from "@/lib/coverage-intake";
import { generatePlan } from "@/lib/ai";
import { inspectUpload, MAX_UPLOAD_BYTES } from "@/lib/documents";
import type { BusinessState, DocumentRecord, Profile } from "@/lib/types";
const ProfileSchema = z.object({
  legalName: z.string().trim().min(2).max(180),
  operatingName: z.string().trim().max(180),
  city: z.string().trim().min(2).max(120),
  province: z.literal("ON"),
  industry: z.enum(["hvac", "electrical", "plumbing", "general"]),
  description: z.string().trim().max(3000),
});
const field = (form: FormData, key: string) => String(form.get(key) ?? "");
async function sameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");
  if (!origin || new URL(origin).host !== host)
    throw new Error("Cross-origin request denied");
}
export async function login(form: FormData) {
  await sameOrigin();
  if (isDemo()) redirect("/");
  if (!configured()) redirect("/?error=Configure+Supabase+first");
  const db = await sessionClient();
  const { error } = await db.auth.signInWithPassword({
    email: field(form, "email"),
    password: field(form, "password"),
  });
  if (error) redirect("/?error=Sign-in+failed");
  redirect("/");
}
export async function logout() {
  await sameOrigin();
  if (!isDemo()) await (await sessionClient()).auth.signOut();
  redirect("/");
}
export async function demoRole(form: FormData) {
  await sameOrigin();
  if (!isDemo()) throw new Error("Demo disabled");
  (await cookies()).set(
    "demo-role",
    field(form, "role") === "client" ? "client" : "broker",
    { httpOnly: true, sameSite: "lax", path: "/" },
  );
  redirect("/");
}
export async function perform(form: FormData) {
  let target = field(form, "businessId");
  let message = "Saved";
  const action = field(form, "action");
  const questionId = field(form, "questionId");
  try {
    await sameOrigin();
    const actor = await currentActor();
    if (!actor) throw new Error("Sign in first");
    if (action === "create") {
      requireBroker(actor);
      const profile = ProfileSchema.parse(
        Object.fromEntries(
          [
            "legalName",
            "operatingName",
            "city",
            "province",
            "industry",
            "description",
          ].map((k) => [k, field(form, k)]),
        ),
      );
      const s: BusinessState = {
        id: randomUUID(),
        organizationId: actor.organizationId,
        assignedClientIds: [],
        revision: 1,
        rulesVersion: COVERAGE_RULE_VERSION,
        fictional: isDemo() || field(form, "fictional") === "on",
        profile,
        answers: {},
        documents: [],
      };
      await createBusiness(actor, s);
      target = s.id;
    } else {
      const s = await getBusiness(actor, target);
      assertAccess(actor, s);
      if (Number(field(form, "revision")) !== s.revision)
        throw new Error("Application changed. Reload before saving.");
      let redirectAfterUpload = false;
      let next: BusinessState;
      let detail: Record<string, unknown> = {};
      switch (action) {
        case "answer":
          next = saveAnswer(
            actor,
            s,
            field(form, "questionId"),
            field(form, "value"),
          );
          detail = { questionId: field(form, "questionId") };
          break;
        case "verify":
          next = verifyAnswer(actor, s, field(form, "questionId"));
          detail = { questionId: field(form, "questionId") };
          break;
        case "assign_client": {
          requireBroker(actor);
          const allowed = await clientMembers(actor);
          const ids = [...new Set(form.getAll("clientIds").map(String))];
          if (ids.some((id) => !allowed.some((m) => m.id === id)))
            throw new Error("Client is not a member of your organization");
          next = changed(s);
          next.assignedClientIds = ids;
          detail = { clientIds: ids };
          break;
        }
        case "profile":
          requireBroker(actor);
          next = changed(s);
          next.answers = Object.fromEntries(
            Object.entries(s.answers).map(([id, a]) => {
              const { verifiedBy, verifiedAt, ...record } = a;
              return [id, record];
            }),
          );
          next.profile = ProfileSchema.parse(
            Object.fromEntries(
              [
                "legalName",
                "operatingName",
                "city",
                "province",
                "industry",
                "description",
              ].map((k) => [k, field(form, k)]),
            ),
          );
          break;
        case "draft": {
          requireBroker(actor);
          const result = await generatePlan(s, field(form, "useAI") === "yes");
          next = attachDraft(actor, s, result.plan, result.mode, result.model);
          detail = { mode: result.mode, model: result.model };
          message =
            "Draft prepared. Review the statements, inferences, and outstanding items.";
          break;
        }
        case "approve":
          if (field(form, "reviewed") !== "on")
            throw new Error("Confirm your broker review before approval");
          next = approve(actor, s);
          detail = {
            approvalId: next.approval!.id,
            digest: next.approval!.digest,
          };
          message = "Broker approval recorded for this exact revision.";
          break;
        case "document_review": {
          requireBroker(actor);
          if (field(form, "documentReviewed") !== "on")
            throw new Error("Confirm document review first");
          const id = field(form, "documentId");
          if (!s.documents.some((d) => d.id === id))
            throw new Error("Document not found");
          next = changed(s);
          next.documents = s.documents.map((d) =>
            d.id === id
              ? {
                  ...d,
                  reviewedBy: actor.id,
                  reviewedAt: new Date().toISOString(),
                }
              : d,
          );
          detail = { documentId: id };
          break;
        }
        case "upload": {
          const file = form.get("file");
          if (!(file instanceof File) || file.size > MAX_UPLOAD_BYTES)
            throw new Error("Choose a PDF or image no larger than 4 MB");
          const bytes = Buffer.from(await file.arrayBuffer());
          const checked = inspectUpload(file.name, bytes);
          const id = randomUUID();
          const path = `${s.organizationId}/${s.id}/${id}.${checked.extension}`;
          const doc: DocumentRecord = {
            id,
            name: file.name.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 180),
            kind:
              field(form, "kind") === "loss_runs"
                ? "loss_runs"
                : field(form, "kind") === "valuation"
                  ? "valuation"
                  : "other",
            path,
            size: bytes.length,
            mime: checked.mime,
            sha256: checked.sha256,
            uploadedBy: actor.id,
            uploadedAt: new Date().toISOString(),
            fictional: s.fictional,
          };
          if (isDemo())
            throw new Error(
              "Uploads are disabled in demo mode. Configure private Supabase storage to test documents.",
            );
          const db = serviceClient();
          const { error } = await db.storage
            .from("client-documents")
            .upload(path, bytes, { contentType: checked.mime, upsert: false });
          if (error) throw new Error("Secure upload failed");
          next = changed(s);
          next.documents = [...s.documents, doc];
          try {
            await commit(actor, s, next, "document_uploaded", {
              documentId: id,
              sha256: doc.sha256,
            });
          } catch (e) {
            await db.storage.from("client-documents").remove([path]);
            throw e;
          }
          redirectAfterUpload = true;
          detail = {};
          break;
        }
        default:
          throw new Error("Unknown action");
      }
      if (!redirectAfterUpload) await commit(actor, s, next!, action, detail);
    }
  } catch (error) {
    const text =
      error instanceof z.ZodError
        ? "Check the profile fields."
        : error instanceof Error
          ? error.message
          : "Operation failed";
    redirect(actionDestination(action, target, "error", text, questionId));
  }
  redirect(actionDestination(action, target, "message", message, questionId));
}
