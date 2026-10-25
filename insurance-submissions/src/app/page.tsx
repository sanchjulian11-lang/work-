import { locationOptions } from "@/lib/location-options";
import { QuestionnaireSession } from "@/components/questionnaire-session";
import { QuestionControls } from "@/components/question-controls";
import { ScheduleInput } from "@/components/schedule-input";
import {
  scheduleIssues,
  LATEST_RULE_VERSION,
  coverageLed,
} from "@/lib/coverage-intake";
import Link from "next/link";
import { configured, currentActor, isDemo } from "@/lib/auth";
import { listBusinesses, auditFor, clientMembers } from "@/lib/repository";
import {
  activeQuestions,
  completeness,
  isVerified,
  RULE_VERSION,
  coverageCodes,
  COVERAGES,
} from "@/lib/rules";
import { renderSubmission } from "@/lib/domain";
import { demoRole, login, logout, perform } from "./actions";
import type { BusinessState, Profile, Rule } from "@/lib/types";
export const dynamic = "force-dynamic";
const tabs = [
  "Overview",
  "Business profile",
  "Questionnaire",
  "Documents",
  "Broker review",
  "Audit trail",
];
function Hidden({ s, action }: { s: BusinessState; action: string }) {
  return (
    <>
      <input type="hidden" name="businessId" value={s.id} />
      <input type="hidden" name="revision" value={s.revision} />
      <input type="hidden" name="action" value={action} />
    </>
  );
}
function ProfileFields({ profile }: { profile?: Profile }) {
  return (
    <div className="form-grid">
      <label>
        Legal name
        <input
          name="legalName"
          defaultValue={profile?.legalName}
          required
          maxLength={180}
        />
      </label>
      <label>
        Operating name
        <input
          name="operatingName"
          defaultValue={profile?.operatingName}
          maxLength={180}
        />
      </label>
      <label>
        City
        <input
          name="city"
          defaultValue={profile?.city}
          required
          maxLength={120}
        />
      </label>
      <label>
        Province
        <input name="province" value="ON" readOnly />
      </label>
      <label>
        Trade
        <select name="industry" defaultValue={profile?.industry ?? "hvac"}>
          <option value="hvac">HVAC</option>
          <option value="electrical">Electrical</option>
          <option value="plumbing">Plumbing</option>
          <option value="general">General contractor</option>
        </select>
      </label>
      <label className="span-2">
        Profile notes
        <textarea
          name="description"
          defaultValue={profile?.description}
          maxLength={3000}
        />
      </label>
    </div>
  );
}
function AnswerInput({
  q,
  value,
  documents,
}: {
  q: Rule;
  value?: string;
  documents: { id: string; name: string }[];
}) {
  const id = `answer-${q.id}`;
  if (q.type === "schedule")
    return (
      <ScheduleInput
        key={value}
        id={q.id}
        fields={q.scheduleFields ?? []}
        value={value}
        documents={documents}
      />
    );
  if (q.type === "select")
    return (
      <select id={id} name="value" defaultValue={value ?? ""}>
        <option value="">Not provided</option>
        {q.options?.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  if (q.type === "boolean")
    return (
      <select id={id} name="value" defaultValue={value ?? ""}>
        <option value="">Not provided</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  if (q.type === "number")
    return (
      <input
        id={id}
        name="value"
        type="number"
        min={q.min ?? 0}
        max={q.max ?? 10000000000}
        step={["years", "employees"].includes(q.id) ? 1 : "0.01"}
        defaultValue={value}
      />
    );
  return (
    <textarea
      id={id}
      name="value"
      defaultValue={value}
      maxLength={6000}
      rows={3}
    />
  );
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const actor = await currentActor();
  if (!actor)
    return (
      <main className="auth-shell">
        <div className="brand-mark">UD</div>
        <p className="eyebrow">UNDERWRITING DESK</p>
        <h1>
          Better intake.
          <br />
          Clearer submissions.
        </h1>
        <p className="muted">
          Ontario commercial insurance · Contractors & trades
        </p>
        <section className="panel auth-panel">
          <h2>
            {configured()
              ? "Sign in to your brokerage"
              : "Connect your environment"}
          </h2>
          {query.error && (
            <p role="alert" className="notice error">
              {query.error}
            </p>
          )}
          {configured() ? (
            <form action={login}>
              <label>
                Work email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button>Sign in securely</button>
            </form>
          ) : (
            <>
              <p>
                Add Supabase credentials in <code>.env.local</code>, apply the
                migration, and run the fictional-account seed. For an isolated
                preview, set <code>DEMO_MODE=true</code>.
              </p>
              <p>No accounts or emails are created automatically.</p>
            </>
          )}
        </section>
        <p className="fine">
          Preparation workspace. Brokers retain coverage, market selection, and
          submission authority.
        </p>
      </main>
    );
  const businesses = await listBusinesses(actor);
  const s = businesses.find((b) => b.id === query.business) ?? businesses[0];
  const broker = actor.role !== "client";
  let tab = query.tab ?? "Overview";
  if (!broker && ["Broker review", "Audit trail"].includes(tab))
    tab = "Overview";
  const check = s ? completeness(s) : null;
  const questionFeedback =
    tab === "Questionnaire" &&
    !!s &&
    activeQuestions(s).some((q) => q.id === query.question);
  const link = (name: string) =>
    `/?business=${s?.id ?? ""}&tab=${encodeURIComponent(name)}`;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">UD</span>
          <span>
            Underwriting
            <br />
            <strong>Desk</strong>
          </span>
        </Link>
        <div className="workspace-label">BROKERAGE WORKSPACE</div>
        <nav aria-label="Workspace">
          {tabs
            .filter(
              (t) => broker || !["Broker review", "Audit trail"].includes(t),
            )
            .map((t, i) => (
              <Link
                key={t}
                className={tab === t ? "nav-item active" : "nav-item"}
                href={link(t)}
              >
                <span className="nav-icon" aria-hidden="true">
                  {["◫", "▤", "☷", "▱", "✓", "◷"][i]}
                </span>
                {t}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" />
          Manual market handoff<p>No emails or insurer transmissions</p>
          <div className="role-label">{actor.role.toUpperCase()}</div>
          <small>{actor.name}</small>
          {!isDemo() && (
            <form action={logout}>
              <button className="text-button">Sign out</button>
            </form>
          )}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Commercial lines <span className="muted">/</span> Ontario
            contractors
          </span>
          <span className="badge">
            {isDemo() ? "Fictional demo" : "Secure workspace"}
          </span>
        </header>
        {isDemo() && (
          <div className="demo-banner">
            <span>
              <strong>Fictional demo</strong> · No live client data, external AI
              calls, or uploads. Demo roles are simulations.
            </span>
            <form action={demoRole}>
              <input
                type="hidden"
                name="role"
                value={broker ? "client" : "broker"}
              />
              <button className="small-button">
                Preview as {broker ? "client" : "broker"}
              </button>
            </form>
          </div>
        )}
        <main className="main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">SUBMISSION PREPARATION</p>
              <h1>{tab}</h1>
              <p className="muted">
                Collect once. Verify the details. Keep the broker in control.
              </p>
            </div>
            <span className="province">
              ON <span>Contractors & trades</span>
            </span>
          </div>
          {query.error &&
            !questionFeedback &&
            (tab !== "Questionnaire" || !query.question) && (
              <div className="notice error" role="alert">
                {query.error}
              </div>
            )}
          {query.message && !questionFeedback && tab !== "Questionnaire" && (
            <div className="notice success" role="status">
              {query.message}
            </div>
          )}
          <div className="business-picker">
            {businesses.map((b) => (
              <Link
                key={b.id}
                href={`/?business=${b.id}&tab=${encodeURIComponent(tab)}`}
                className={
                  b.id === s?.id ? "business-pill selected" : "business-pill"
                }
              >
                {b.profile.operatingName || b.profile.legalName}
                {b.copiedFrom ? " · updated intake" : ""}
              </Link>
            ))}
          </div>
          {!s ? (
            <section className="panel">
              <h2>No assigned businesses</h2>
              <p>
                {broker
                  ? "Create your first application below."
                  : "Your brokerage must assign a business to your account."}
              </p>
            </section>
          ) : (
            <>
              <section className="account-header">
                <div className="account-icon">
                  {s.profile.industry === "hvac" ? "❄" : "⌂"}
                </div>
                <div>
                  <h2>{s.profile.legalName}</h2>
                  <p>
                    {s.profile.city}, Ontario <span>·</span>{" "}
                    {s.profile.industry.toUpperCase()} <span>·</span> Revision{" "}
                    {s.revision}
                  </p>
                </div>
                <div className={`readiness ${s.approval ? "approved" : ""}`}>
                  {s.approval
                    ? "Broker approved"
                    : check!.ready
                      ? "Ready for broker review"
                      : "Information required"}
                </div>
              </section>
              {tab === "Overview" && (
                <>
                  <div className="stats">
                    <section>
                      <span>Recorded answers</span>
                      <strong>
                        {check!.answered}
                        <small> / {check!.total}</small>
                      </strong>
                      <p>Relevant questions only</p>
                    </section>
                    <section>
                      <span>Awaiting verification</span>
                      <strong>{check!.unverified.length}</strong>
                      <p>Recorded statements to review</p>
                    </section>
                    <section>
                      <span>Missing answers</span>
                      <strong>{check!.missing.length}</strong>
                      <p>Never filled in by AI</p>
                    </section>
                    <section>
                      <span>Documents</span>
                      <strong>{s.documents.length}</strong>
                      <p>
                        {s.documents.filter((d) => !d.reviewedBy).length}{" "}
                        awaiting review
                      </p>
                    </section>
                  </div>
                  <div className="two-col">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Application progress</h2>
                        <span className="badge">Rules-based</span>
                      </div>
                      <ol className="steps">
                        <li className="done">
                          <b>Business profile</b>
                          <span>Industry and Ontario location recorded</span>
                        </li>
                        <li className={check!.missing.length ? "" : "done"}>
                          <b>Complete the application</b>
                          <span>
                            {check!.missing.length} required answers outstanding
                          </span>
                        </li>
                        <li className={check!.ready ? "done" : ""}>
                          <b>Broker verification</b>
                          <span>
                            Review statements, documents, and open questions
                          </span>
                        </li>
                        <li className={s.approval ? "done" : ""}>
                          <b>Approve & prepare handoff</b>
                          <span>
                            Final export requires approval for this revision
                          </span>
                        </li>
                      </ol>
                      <Link className="button" href={link("Questionnaire")}>
                        Continue questionnaire <span>→</span>
                      </Link>
                    </section>
                    <section className="panel">
                      <h2>Next information to collect</h2>
                      <p className="muted">
                        Follow-ups triggered by this business’s recorded
                        operations.
                      </p>
                      <ul className="task-list">
                        {activeQuestions(s)
                          .filter((q) => check!.missing.includes(q.id))
                          .slice(0, 5)
                          .map((q) => (
                            <li key={q.id}>
                              <span className="empty-check" />
                              {q.label}
                            </li>
                          ))}
                        {!check!.missing.length && (
                          <li>
                            All required answers are recorded. Review
                            verification and documents next.
                          </li>
                        )}
                      </ul>
                    </section>
                  </div>
                  <section className="panel subtle">
                    <h2>Facts stay separate from interpretation</h2>
                    <p>
                      Client statements and broker-recorded answers carry their
                      source, question version, and verification history.
                      Coverage considerations are labelled as inferences. This
                      starter rule library is not an insurer application or an
                      appetite determination.
                    </p>
                    <span className="mono">{s.rulesVersion}</span>
                  </section>
                </>
              )}
              {tab === "Business profile" && (
                <section className="panel">
                  <h2>Business details</h2>
                  {broker ? (
                    <form action={perform}>
                      <Hidden s={s} action="profile" />
                      <ProfileFields profile={s.profile} />
                      <p className="fine">
                        Saving changes invalidates any draft and broker
                        approval. Previously recorded answers remain available;
                        only relevant questions appear.
                      </p>
                      <button>Save business profile</button>
                    </form>
                  ) : (
                    <dl>
                      <dt>Legal name</dt>
                      <dd>{s.profile.legalName}</dd>
                      <dt>Location</dt>
                      <dd>{s.profile.city}, ON</dd>
                      <dt>Operations profile</dt>
                      <dd>{s.profile.description}</dd>
                    </dl>
                  )}
                </section>
              )}
              {tab === "Business profile" && broker && (
                <section className="panel">
                  <h2>Client portal access</h2>
                  <p className="muted">
                    Only assigned client members can access this application.
                    Account provisioning is an administrator operation.
                  </p>
                  <form action={perform}>
                    <Hidden s={s} action="assign_client" />
                    {(await clientMembers(actor)).map((member) => (
                      <label className="checkbox" key={member.id}>
                        <input
                          type="checkbox"
                          name="clientIds"
                          value={member.id}
                          defaultChecked={s.assignedClientIds.includes(
                            member.id,
                          )}
                        />
                        {member.label}
                      </label>
                    ))}
                    <button className="secondary">
                      Save client assignments
                    </button>
                  </form>
                </section>
              )}
              {tab === "Questionnaire" && (
                <QuestionnaireSession
                  key={s.id}
                  businessId={s.id}
                  revision={s.revision}
                  autoSave={coverageLed(s.rulesVersion)}
                >
                  {s.copiedFrom && (
                    <p className="notice">
                      Updated intake copied from saved answers. Review and
                      verify the answers again, reattach supporting documents,
                      and assign clients separately. The original application is
                      retained.
                    </p>
                  )}
                  {broker && s.rulesVersion !== LATEST_RULE_VERSION && (
                    <section className="panel">
                      <h2>Updated questionnaire available</h2>
                      <p>
                        The updated workflow keeps vehicle-use questions inside
                        auto coverage. Start an updated copy with your saved
                        answers. Verification and approval must be reviewed
                        again; documents and client assignments are not copied.
                      </p>
                      <form action={perform}>
                        <Hidden s={s} action="update_intake" />
                        <button>Start updated intake from saved answers</button>
                      </form>
                    </section>
                  )}
                  <div className="notice">
                    {coverageLed(s.rulesVersion)
                      ? "Coverage-led common intake: the broker selects requested coverages. Only their detailed modules open. "
                      : "Legacy contractor intake. Create a new application to use coverage-led intake; this record retains its original rules. "}
                    Answer only what is known. Leave missing information blank.
                    A broker must verify recorded statements before final
                    approval.
                  </div>
                  {Array.from(
                    new Set(activeQuestions(s).map((q) => q.section)),
                  ).map((section) => (
                    <section className="panel" key={section}>
                      <h2>{section}</h2>
                      {activeQuestions(s)
                        .filter((q) => q.section === section)
                        .map((q) => {
                          const a = s.answers[q.id];
                          return (
                            <article
                              className="question"
                              key={q.id}
                              id={`question-${q.id}`}
                            >
                              {!coverageLed(s.rulesVersion) &&
                                questionFeedback &&
                                query.question === q.id &&
                                query.error && (
                                  <div className="notice error" role="alert">
                                    {query.error}
                                  </div>
                                )}
                              {!coverageLed(s.rulesVersion) &&
                                questionFeedback &&
                                query.question === q.id &&
                                query.message && (
                                  <div className="notice success" role="status">
                                    {query.message}
                                  </div>
                                )}
                              <div className="section-heading">
                                <label htmlFor={`answer-${q.id}`}>
                                  {q.label} <span className="required">*</span>
                                </label>
                                <span
                                  className={
                                    isVerified(s, q.id) ? "badge good" : "badge"
                                  }
                                >
                                  {isVerified(s, q.id)
                                    ? "Broker verified"
                                    : a?.value
                                      ? "Unverified"
                                      : "Not provided"}
                                </span>
                              </div>
                              {q.type === "schedule" &&
                                a?.value &&
                                scheduleIssues(
                                  q.id,
                                  a.value,
                                  q.scheduleFields ?? [],
                                ).length > 0 && (
                                  <ul className="issue-list">
                                    {scheduleIssues(
                                      q.id,
                                      a.value,
                                      q.scheduleFields ?? [],
                                    )
                                      .slice(0, 8)
                                      .map((issue, i) => (
                                        <li key={i}>{issue}</li>
                                      ))}
                                  </ul>
                                )}
                              {q.when && (
                                <p className="conditional">
                                  Follow-up · {q.when.id.replaceAll("_", " ")} ={" "}
                                  {q.when.equals}
                                </p>
                              )}
                              {coverageLed(s.rulesVersion) ? (
                                <QuestionControls
                                  q={q}
                                  locations={locationOptions(
                                    s.answers.locations?.value,
                                  )}
                                  answer={a}
                                  documents={s.documents.map((d) => ({
                                    id: d.id,
                                    name: d.name,
                                  }))}
                                  broker={broker}
                                  verified={isVerified(s, q.id)}
                                />
                              ) : (
                                <>
                                  <form action={perform}>
                                    <Hidden s={s} action="answer" />
                                    <input
                                      type="hidden"
                                      name="questionId"
                                      value={q.id}
                                    />
                                    <fieldset
                                      disabled={
                                        !broker &&
                                        q.provenance.owner === "broker"
                                      }
                                    >
                                      {q.provenance.owner === "broker" && (
                                        <p className="fine">
                                          Broker decision / review required
                                        </p>
                                      )}
                                      <AnswerInput
                                        q={q}
                                        value={a?.value}
                                        documents={s.documents}
                                      />
                                      <div className="answer-actions">
                                        <button className="secondary small-button">
                                          Save answer
                                        </button>
                                        <span className="fine">
                                          {a
                                            ? `${a.source === "client_statement" ? "Client statement" : "Broker recorded"} · ${new Date(a.recordedAt).toLocaleDateString("en-CA", { timeZone: "UTC" })}`
                                            : "No recorded statement"}
                                        </span>
                                      </div>
                                    </fieldset>
                                  </form>
                                  {broker &&
                                    a?.value &&
                                    !isVerified(s, q.id) && (
                                      <form action={perform}>
                                        <Hidden s={s} action="verify" />
                                        <input
                                          type="hidden"
                                          name="questionId"
                                          value={q.id}
                                        />
                                        <button className="text-button">
                                          Verify recorded statement
                                        </button>
                                      </form>
                                    )}
                                </>
                              )}
                              <details>
                                <summary>
                                  Question provenance & verification
                                </summary>
                                <p className="fine">
                                  {q.provenance.source}
                                  <br />
                                  {q.provenance.reference}
                                  <br />
                                  Version: {q.provenance.version}
                                  <br />
                                  Question owner: {q.provenance.owner}
                                  <br />
                                  Recorded by: {a?.recordedBy ?? "—"}
                                  <br />
                                  Verified by: {a?.verifiedBy ??
                                    "Not verified"}{" "}
                                  {a?.verifiedAt ?? ""}
                                </p>
                              </details>
                            </article>
                          );
                        })}
                    </section>
                  ))}
                </QuestionnaireSession>
              )}
              {tab === "Documents" && (
                <div className="two-col">
                  <section className="panel">
                    <h2>Supporting documents</h2>
                    <p className="muted">
                      Private storage. PDF, PNG, or JPEG, up to 4 MB. Files are
                      supporting evidence, not automatically verified facts.
                    </p>
                    <form action={perform}>
                      <Hidden s={s} action="upload" />
                      <label>
                        Document category
                        <select name="kind">
                          <option value="valuation">
                            External property valuation
                          </option>
                          <option value="other">Supporting document</option>
                          <option value="loss_runs">
                            Loss record / loss runs
                          </option>
                        </select>
                      </label>
                      <label>
                        Select document
                        <input
                          type="file"
                          name="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          required
                          disabled={isDemo()}
                        />
                      </label>
                      <button disabled={isDemo()}>Upload securely</button>
                    </form>
                    <p className="fine">
                      Files are not sent to OpenAI or insurers. Signature checks
                      are not malware scanning; review attachments in your
                      organization’s protected document viewer.
                    </p>
                  </section>
                  <section className="panel">
                    <h2>Document register</h2>
                    {!s.documents.length ? (
                      <div className="empty">
                        <span>▱</span>
                        <h3>No documents uploaded</h3>
                        <p>
                          Required loss records appear in completeness checks
                          when losses are reported.
                        </p>
                      </div>
                    ) : (
                      s.documents.map((d) => (
                        <article className="document" key={d.id}>
                          <h3>{d.name}</h3>
                          <p className="fine">
                            {d.kind} · {Math.ceil(d.size / 1024)} KB ·{" "}
                            {d.reviewedBy
                              ? "Broker reviewed"
                              : "Review pending"}
                          </p>
                          <a
                            href={`/api/documents/${s.id}/${d.id}`}
                            className="text-button"
                          >
                            Download attachment
                          </a>
                          {broker && !d.reviewedBy && (
                            <form action={perform}>
                              <Hidden s={s} action="document_review" />
                              <input
                                type="hidden"
                                name="documentId"
                                value={d.id}
                              />
                              <label className="checkbox">
                                <input
                                  type="checkbox"
                                  name="documentReviewed"
                                  required
                                />
                                I reviewed this attachment and its relevance.
                              </label>
                              <button className="secondary small-button">
                                Record document review
                              </button>
                            </form>
                          )}
                        </article>
                      ))
                    )}
                  </section>
                </div>
              )}
              {tab === "Broker review" && broker && (
                <>
                  <div className="two-col">
                    <section className="panel">
                      <h2>Completeness check</h2>
                      <p className="muted">
                        Common intake completeness; insurer acceptance and
                        insurer-specific requirements are separate.
                      </p>
                      <div className="check-row">
                        <span>Required answers</span>
                        <b>
                          {check!.missing.length ? "Incomplete" : "Recorded"}
                        </b>
                      </div>
                      <div className="check-row">
                        <span>Statement verification</span>
                        <b>
                          {check!.unverified.length ? "Pending" : "Complete"}
                        </b>
                      </div>
                      <div className="check-row">
                        <span>Supporting documents</span>
                        <b>
                          {check!.documentIssues.length
                            ? "Pending"
                            : "No open items"}
                        </b>
                      </div>
                      <ul className="issue-list">
                        {check!.missing.map((id) => (
                          <li key={id}>
                            Missing:{" "}
                            {activeQuestions(s).find((q) => q.id === id)?.label}
                          </li>
                        ))}
                        {check!.unverified.length > 0 && (
                          <li>
                            {check!.unverified.length} recorded statements need
                            broker verification.
                          </li>
                        )}
                        {[
                          ...check!.profileIssues,
                          ...check!.documentIssues,
                        ].map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </section>
                    <section className="panel">
                      <h2>Coverage considerations</h2>
                      <p className="muted">
                        Rule-derived inferences for your review, not verified
                        client facts or recommendations to bind.
                      </p>
                      {coverageCodes(s).map((code) => (
                        <div className="coverage" key={code}>
                          <b>
                            {COVERAGES[code as keyof typeof COVERAGES].label}
                          </b>
                          <p>
                            {
                              COVERAGES[code as keyof typeof COVERAGES]
                                .rationale
                            }
                          </p>
                        </div>
                      ))}
                    </section>
                  </div>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Submission summary</h2>
                      <span className="badge">
                        {s.draft?.mode === "ai"
                          ? "AI-assisted reference plan"
                          : s.draft
                            ? "Rules-based draft"
                            : "Not generated"}
                      </span>
                    </div>
                    <p className="muted">
                      AI can order verified facts and select permitted coverage
                      references. Facts are rendered from the recorded answers;
                      the model cannot supply new values or free-form claims.
                    </p>
                    <div className="button-row">
                      <form action={perform}>
                        <Hidden s={s} action="draft" />
                        <button className="secondary">
                          Prepare rules-based draft
                        </button>
                      </form>
                      <form action={perform}>
                        <Hidden s={s} action="draft" />
                        <input type="hidden" name="useAI" value="yes" />
                        <button
                          disabled={
                            isDemo() ||
                            process.env.AI_PROCESSING_ENABLED !== "true"
                          }
                        >
                          Prepare AI-assisted draft
                        </button>
                      </form>
                    </div>
                    {s.draft && (
                      <>
                        <pre className="summary-preview">
                          {renderSubmission(s)}
                        </pre>
                        <p className="fine">
                          Draft {s.draft.id} · {s.draft.model} · Revision{" "}
                          {s.draft.revision}
                        </p>
                      </>
                    )}
                  </section>
                  <section className="panel approval-panel">
                    <div>
                      <p className="eyebrow">BROKER CONTROL</p>
                      <h2>Review. Approve. Then export.</h2>
                      <p>
                        Approval binds this revision and draft. Any answer,
                        profile, document, or draft change requires fresh
                        approval.
                      </p>
                    </div>
                    {!s.approval ? (
                      <form action={perform}>
                        <Hidden s={s} action="approve" />
                        <label className="checkbox">
                          <input name="reviewed" type="checkbox" required />I
                          reviewed the business profile, all recorded
                          statements, source documents, and coverage
                          considerations.
                        </label>
                        <button disabled={!check!.ready || !s.draft}>
                          Approve this revision
                        </button>
                      </form>
                    ) : (
                      <>
                        <p className="notice success">
                          Approved by {s.approval.brokerName}. A final export is
                          recorded as an immutable snapshot.
                        </p>
                        <form
                          action={`/api/submission/${s.id}?format=pdf`}
                          method="post"
                        >
                          <button>Download submission PDF</button>
                        </form>
                      </>
                    )}
                    <p className="fine">
                      Download only. No insurer connections, email sending, or
                      automatic transmission.
                    </p>
                  </section>
                </>
              )}
              {tab === "Audit trail" && broker && (
                <section className="panel">
                  <h2>Activity & provenance</h2>
                  <p className="muted">
                    Append-only history in connected mode. Logs record actions
                    and identifiers, not answer text or file contents.
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Actor</th>
                          <th>Revision</th>
                          <th>Time (UTC)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(await auditFor(actor, s)).map((e) => (
                          <tr key={e.id}>
                            <td>{e.action.replaceAll("_", " ")}</td>
                            <td>{e.actorName}</td>
                            <td>{e.revision}</td>
                            <td>
                              {new Date(e.at)
                                .toISOString()
                                .replace("T", " ")
                                .slice(0, 19)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
          {broker && tab === "Overview" && (
            <details className="panel">
              <summary>Create another business profile</summary>
              <form action={perform}>
                <input type="hidden" name="action" value="create" />
                <p>
                  New applications use coverage-led common intake for CGL,
                  property, auto, equipment and E&amp;O. Insurer-specific
                  requirements require a separate broker check.
                </p>
                <ProfileFields />
                <label className="checkbox">
                  <input type="checkbox" name="fictional" />
                  Fictional test application — never for real placement
                </label>
                <button>Create application</button>
              </form>
            </details>
          )}
          <footer>
            Underwriting Desk <span>·</span> Versioned intake rules{" "}
            <span>·</span> Broker-led placement
            <br />
            <small>
              {s?.rulesVersion ?? LATEST_RULE_VERSION} · Common broker intake
              specification; broker validation required before live use.
            </small>
          </footer>
        </main>
      </div>
    </div>
  );
}
