import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { getBusiness, privateInvitations } from "@/lib/repository";
import { intakeView } from "@/lib/intake-workflow";
import { GuidedIntake } from "@/components/guided-intake";
import { PrivateInvitation } from "@/components/private-invitation";
import { PILOT_RESEARCH } from "@/lib/workflow-research";
export default async function IntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/");
  const { id } = await params;
  let s;
  try {
    s = await getBusiness(actor, id);
  } catch {
    notFound();
  }
  const broker = actor.role !== "client";
  return (
    <main className="intake-shell">
      <Link href={broker ? "/review" : "/"}>
        {broker ? "Broker queue" : "My applications"}
      </Link>
      <h1>{s.profile.legalName}</h1>
      <p>
        {s.profile.city}, {s.profile.province} ·{" "}
        {s.fictional ? "Fictional test application" : "Private client intake"}
      </p>
      <p>
        Business details or requested protection incorrect? Tell your broker
        before final review.
      </p>
      {broker && (
        <>
          <PrivateInvitation
            key={s.id}
            businessId={s.id}
            invitations={await privateInvitations(actor, s)}
          />
          <p>
            <Link href={`/?business=${s.id}&tab=Broker%20review`}>
              Open broker verification and approval
            </Link>{" "}
            ·{" "}
            <Link href={`/?business=${s.id}&tab=Business%20profile`}>
              Edit profile or client assignments
            </Link>
          </p>
        </>
      )}
      {broker && (
        <details className="panel">
          <summary>Research basis and limits of this pilot</summary>
          <p>{PILOT_RESEARCH.scope}</p>
          <p>{PILOT_RESEARCH.limitation}</p>
          <ul>
            {PILOT_RESEARCH.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>{" "}
                · {source.edition} · accessed {PILOT_RESEARCH.reviewed}
              </li>
            ))}
          </ul>
          <p>
            These are research references, not a claim that every question below
            appears in each form. Confirm current insurer-specific requirements
            separately.
          </p>
        </details>
      )}
      <GuidedIntake key={s.id} initial={intakeView(s)} broker={broker} />
    </main>
  );
}
