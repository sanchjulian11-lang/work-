import Link from "next/link";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth";
import { listBusinesses } from "@/lib/repository";
import { clientGaps, intakeStatus } from "@/lib/intake-workflow";
import { createFictionalPilot } from "@/app/intake-actions";
import { workflowTime } from "@/lib/workflow-time";
export default async function ReviewQueue() {
  const actor = await currentActor();
  if (!actor || actor.role === "client") redirect("/");
  const businesses = await listBusinesses(actor);
  return (
    <main className="intake-shell">
      <Link href="/">Broker workspace</Link>
      <h1>Client intake review queue</h1>
      <p>
        Client submissions can contain unknowns. Broker verification and final
        approval remain separate.
      </p>
      <form action={createFictionalPilot}>
        <button>Create fictional HVAC CGL pilot</button>
      </form>
      {businesses.map((s) => {
        const last = s.intake?.submissions.at(-1);
        return (
          <article className="panel" key={s.id}>
            <h2>
              <Link href={"/intake/" + s.id}>{s.profile.legalName}</Link>
            </h2>
            <p>
              {intakeStatus(s)} · {clientGaps(s).length} current information
              gaps ·{" "}
              {s.intake?.requests.filter((r) => !r.resolvedAt).length ?? 0} open
              clarifications
            </p>
            <p>
              {last
                ? `Last submitted ${workflowTime(last.submittedAt)}, revision ${last.revision}; current revision ${s.revision}`
                : "No client submission recorded"}
            </p>
            <Link href={`/?business=${s.id}&tab=Broker%20review`}>
              Broker review and approval
            </Link>
          </article>
        );
      })}
    </main>
  );
}
