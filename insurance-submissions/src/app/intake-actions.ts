"use server";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import {
  currentActor,
  currentIdentity,
  isDemo,
  sessionClient,
} from "@/lib/auth";
import {
  getBusiness,
  commit,
  issuePrivateInvitation,
  revokePrivateInvitation,
  claimPrivateInvitation,
  createBusiness,
} from "@/lib/repository";
import {
  intakeView,
  saveIntakeResponse,
  submitIntake,
  requestClarification,
  respondClarification,
  resolveClarification,
} from "@/lib/intake-workflow";
import type { IntakeView, ResponseStatus } from "@/lib/intake-workflow";
import type { BusinessState } from "@/lib/types";
import { requireBroker, saveAnswer } from "@/lib/domain";
import { PREMARKET_RULE_VERSION } from "@/lib/coverage-intake";
const field = (f: FormData, k: string) => String(f.get(k) ?? "");
async function originCheck() {
  const h = await headers();
  const o = h.get("origin");
  if (!o || new URL(o).host !== h.get("host"))
    throw new Error("Cross-origin request denied");
}
export async function intakeCommand(
  f: FormData,
): Promise<{ view?: IntakeView; error?: string; conflict?: boolean }> {
  try {
    await originCheck();
    const actor = await currentActor();
    if (!actor) throw new Error("Sign in first");
    const s = await getBusiness(actor, field(f, "businessId"));
    if (s.revision !== Number(field(f, "revision")))
      return {
        view: intakeView(s),
        error:
          "Someone changed this application. Compare the latest saved answer with your draft before retrying.",
        conflict: true,
      };
    const action = field(f, "action");
    let next: BusinessState;
    switch (action) {
      case "save_response":
        next = saveIntakeResponse(
          actor,
          s,
          field(f, "questionId"),
          field(f, "value"),
          field(f, "status") as ResponseStatus,
        );
        break;
      case "submit_intake":
        next = submitIntake(actor, s, field(f, "confirmed") === "yes");
        break;
      case "clarification_request":
        next = requestClarification(
          actor,
          s,
          field(f, "questionId"),
          field(f, "prompt"),
        );
        break;
      case "clarification_response":
        next = respondClarification(
          actor,
          s,
          field(f, "requestId"),
          field(f, "response"),
        );
        break;
      case "clarification_resolve":
        next = resolveClarification(
          actor,
          s,
          field(f, "requestId"),
          field(f, "resolution"),
        );
        break;
      default:
        throw new Error("Unsupported workflow action");
    }
    try {
      await commit(actor, s, next, action, {
        questionId: field(f, "questionId"),
        requestId: field(f, "requestId"),
      });
    } catch {
      return {
        error:
          "Save could not be confirmed. Reload the latest saved version and compare before retrying.",
        conflict: true,
      };
    }
    return { view: intakeView(next) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save" };
  }
}
export async function refreshIntake(id: string) {
  const a = await currentActor();
  if (!a) throw new Error("Sign in first");
  return intakeView(await getBusiness(a, id));
}
export async function createPrivateLink(f: FormData) {
  try {
    await originCheck();
    const a = await currentActor();
    if (!a) throw new Error("Sign in first");
    const s = await getBusiness(a, field(f, "businessId"));
    const token = await issuePrivateInvitation(
      a,
      s,
      field(f, "email"),
      Number(field(f, "days")),
    );
    return { path: "/invite#token=" + token };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invitation failed" };
  }
}
export async function revokeLink(f: FormData) {
  await originCheck();
  const a = await currentActor();
  if (!a) throw new Error("Sign in first");
  await revokePrivateInvitation(
    a,
    await getBusiness(a, field(f, "businessId")),
    field(f, "invitationId"),
  );
}
export async function claimLink(f: FormData) {
  let id: string;
  try {
    await originCheck();
    const i = await currentIdentity();
    if (!i) throw new Error("Sign in with your invited email first");
    id = await claimPrivateInvitation(i, field(f, "token"));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Claim failed" };
  }
  redirect("/intake/" + id);
}
export async function invitationAuth(f: FormData) {
  try {
    await originCheck();
    if (isDemo()) {
      (await cookies()).set("demo-role", "client", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      return { message: "Fictional client signed in" };
    }
    const email = field(f, "email").trim(),
      password = field(f, "password");
    if (!password || (field(f, "mode") === "signup" && password.length < 12))
      throw new Error("New accounts need a password of at least 12 characters");
    const db = await sessionClient();
    if (field(f, "mode") === "signup") {
      const { error } = await db.auth.signUp({ email, password });
      if (error)
        throw new Error(
          "Account could not be created. Try signing in or ask your broker for help.",
        );
      return {
        message:
          "Check your email to confirm your account, then return to this invitation and sign in.",
      };
    }
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Sign-in failed");
    return { message: "Signed in" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sign-in failed" };
  }
}
export async function createFictionalPilot() {
  await originCheck();
  const a = await currentActor();
  if (!a) throw new Error("Sign in first");
  requireBroker(a);
  let s: BusinessState = {
    id: randomUUID(),
    organizationId: a.organizationId,
    assignedClientIds: [],
    revision: 1,
    rulesVersion: PREMARKET_RULE_VERSION,
    fictional: true,
    profile: {
      legalName: "Fictional HVAC Service Pilot Ltd.",
      operatingName: "Fictional HVAC",
      city: "London",
      province: "ON",
      industry: "hvac",
      description: "Fictional Ontario HVAC service/repair workflow test",
    },
    answers: {},
    documents: [],
  };
  for (const c of ["cgl", "property", "auto", "equipment", "professional"])
    s = saveAnswer(a, s, "cover_" + c, c === "cgl" ? "yes" : "no");
  s.revision = 1;
  await createBusiness(a, s);
  redirect("/intake/" + s.id);
}
