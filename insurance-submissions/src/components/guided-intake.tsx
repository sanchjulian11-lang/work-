"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { intakeCommand, refreshIntake } from "@/app/intake-actions";
import type { IntakeView, ResponseStatus } from "@/lib/intake-workflow";
import { ScheduleInput } from "./schedule-input";
import { locationOptions } from "@/lib/location-options";
import { workflowTime } from "@/lib/workflow-time";
import type { Rule } from "@/lib/types";
const stages = [
  "Your business and work",
  "Business addresses and documents",
  "Insurance and requested terms",
  "Review and send",
];
const labels: Record<string, string> = {
  operations: "What work does your business do?",
  years: "How many years has this business operated?",
  revenue: "Estimated annual business revenue (CAD)",
  payroll: "Estimated annual payroll (CAD)",
  employees: "How many employees do you have?",
  experience:
    "Tell us about the principals’ experience and trade qualifications.",
  territory: "Where do you work or sell your services?",
  revenue_split:
    "How is your revenue split between types of work? Include percentages totalling 100%.",
  locations: "Where does your business operate?",
  current_insurance:
    "Tell us about any current insurance, or say if the business has not previously been insured.",
  claims: "Have there been claims, losses or incidents in the past five years?",
  effective_date: "When would you like the requested coverage to start?",
};
function stage(q: Rule) {
  if (q.id === "locations") return 1;
  if (
    q.section === "Insurance history" ||
    [
      "current_insurance",
      "claims",
      "claims_details",
      "effective_date",
      "cgl_limits",
      "cgl_contracts",
    ].includes(q.id)
  )
    return 2;
  return 0;
}
type Draft = { value: string; status: ResponseStatus };
export function GuidedIntake({
  initial,
  broker,
}: {
  initial: IntakeView;
  broker: boolean;
}) {
  const [view, setView] = useState(initial),
    [step, setStep] = useState(0),
    [drafts, setDrafts] = useState<Record<string, Draft>>({}),
    [pending, setPending] = useState(0),
    [blocked, setBlocked] = useState(false),
    [message, setMessage] = useState(""),
    [notes, setNotes] = useState<Record<string, string>>({}),
    [confirmed, setConfirmed] = useState(false),
    [latestLoaded, setLatestLoaded] = useState(false);
  const current = useRef(initial),
    noteDrafts = useRef<Record<string, string>>({}),
    dirty = useRef<Record<string, Draft>>({}),
    queue = useRef(Promise.resolve()),
    halted = useRef(false),
    outstanding = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function apply(v: IntakeView) {
    current.current = v;
    setView(v);
  }
  function goToStep(n: number) {
    setStep(n);
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(n));
    window.history.replaceState(null, "", url);
  }
  useEffect(() => {
    const n = Number(new URL(window.location.href).searchParams.get("step"));
    if (Number.isInteger(n) && n >= 0 && n < stages.length) setStep(n);
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (
        Object.keys(dirty.current).length ||
        Object.values(noteDrafts.current).some(Boolean) ||
        outstanding.current
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  async function command(action: string, values: Record<string, string> = {}) {
    const form = new FormData();
    for (const [k, v] of Object.entries({
      businessId: current.current.id,
      revision: String(current.current.revision),
      action,
      ...values,
    }))
      form.set(k, v);
    const result = await intakeCommand(form);
    if (result.view) apply(result.view);
    if (result.error) {
      if (result.conflict) {
        halted.current = true;
        setBlocked(true);
        setLatestLoaded(false);
      }
      throw new Error(result.error);
    }
  }
  function flush() {
    const batch = Object.entries(dirty.current).filter(([id]) =>
      current.current.questions.some((q) => q.id === id),
    );
    if (!batch.length) return queue.current;
    outstanding.current++;
    setPending(outstanding.current);
    const task = queue.current
      .then(async () => {
        if (halted.current) return;
        for (const [id, draft] of batch) {
          if (!current.current.questions.some((q) => q.id === id)) continue;
          if (dirty.current[id] !== draft) continue;
          try {
            await command("save_response", { questionId: id, ...draft });
            if (dirty.current[id] === draft) {
              delete dirty.current[id];
              setDrafts({ ...dirty.current });
            }
          } catch (e) {
            halted.current = true;
            setBlocked(true);
            setLatestLoaded(false);
            setMessage(
              e instanceof Error ? e.message : "Save could not be confirmed",
            );
            break;
          }
        }
      })
      .finally(() => {
        outstanding.current--;
        setPending(outstanding.current);
      });
    queue.current = task.catch(() => {});
    return task;
  }
  function edit(id: string, value: string, status: ResponseStatus) {
    dirty.current[id] = { value, status };
    setDrafts({ ...dirty.current });
    setMessage("");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, 650);
  }
  async function run(action: string, values: Record<string, string> = {}) {
    if (timer.current) clearTimeout(timer.current);
    await flush();
    if (halted.current) return false;
    outstanding.current++;
    setPending(outstanding.current);
    try {
      await command(action, values);
      setMessage(
        action === "submit_intake"
          ? "Your saved information was sent to your broker. You can return to add more information."
          : "Saved",
      );
      return true;
    } catch (e) {
      setMessage(
        (e instanceof Error ? e.message : "Could not save") +
          " Your message has not been confirmed; keep it here and retry.",
      );
      return false;
    } finally {
      outstanding.current--;
      setPending(outstanding.current);
    }
  }
  function editNote(key: string, value: string) {
    noteDrafts.current = { ...noteDrafts.current, [key]: value };
    setNotes(noteDrafts.current);
  }
  async function sendNote(
    action: string,
    values: Record<string, string>,
    key: string,
    field: string,
    form: FormData,
  ) {
    const value = String(form.get(field) ?? "");
    if (await run(action, { ...values, [field]: value })) {
      // Do not erase text typed while the previous message was being sent.
      if (noteDrafts.current[key] === value) editNote(key, "");
    }
  }
  const activeDirty = Object.keys(drafts).filter((id) =>
    view.questions.some((q) => q.id === id),
  ).length;
  return (
    <div>
      <p className="badge">{view.status}</p>
      <p role="status" className="save-status">
        {blocked
          ? "Saving paused"
          : pending || activeDirty
            ? "Saving changes…"
            : Object.values(notes).some(Boolean)
              ? "Answers saved · message not sent"
              : "All changes saved"}
      </p>
      {message && (
        <p role={blocked ? "alert" : "status"} className="notice">
          {message}
        </p>
      )}
      {blocked && (
        <div className="notice error">
          <p>
            Your draft is retained here. Compare it with the latest saved
            answers before retrying.
          </p>
          <button
            disabled={pending > 0}
            onClick={async () => {
              try {
                apply(await refreshIntake(view.id));
                setLatestLoaded(true);
                setMessage(
                  "Latest saved information loaded. Compare your drafts, then choose Retry my changes.",
                );
              } catch {
                setMessage(
                  "Could not load latest information; retry when connected.",
                );
              }
            }}
          >
            Load latest saved information
          </button>
          <button
            disabled={pending > 0 || !latestLoaded}
            onClick={() => {
              halted.current = false;
              setBlocked(false);
              setLatestLoaded(false);
              void flush();
            }}
          >
            Retry my changes
          </button>
          <button
            className="secondary"
            disabled={pending > 0 || !latestLoaded}
            onClick={() => {
              dirty.current = {};
              setDrafts({});
              halted.current = false;
              setBlocked(false);
              setLatestLoaded(false);
              setMessage(
                "Using the latest saved information. Your unsaved drafts were discarded.",
              );
            }}
          >
            Use latest answers and discard my drafts
          </button>
        </div>
      )}
      <nav aria-label="Intake steps" className="intake-steps">
        {stages.map((name, n) => (
          <button
            key={name}
            aria-current={step === n ? "step" : undefined}
            className={step === n ? "" : "secondary"}
            disabled={pending > 0}
            onClick={async () => {
              await flush();
              if (!halted.current) goToStep(n);
            }}
          >
            {n + 1}. {name}
          </button>
        ))}
      </nav>
      <h2>{stages[step]}</h2>
      <p>
        Answer what you know. Choose “I don’t know” or “Not available yet” when
        you need help. Your broker will review your information.
      </p>
      {step < 3 &&
        view.questions
          .filter((q) => stage(q) === step)
          .map((q) => {
            const a = view.answers[q.id],
              raw = view.drafts[q.id],
              d = drafts[q.id];
            const value = d?.value ?? raw?.value ?? a?.value ?? "",
              status = d?.status ?? raw?.status ?? a?.status ?? "answered";
            return (
              <article className="panel" id={"guided-" + q.id} key={q.id}>
                <label htmlFor={"intake-" + q.id}>
                  <strong>{labels[q.id] ?? q.label}</strong>
                </label>
                <label className="fine">
                  Information available
                  <select
                    aria-label={"Answer status: " + q.id}
                    value={status}
                    onChange={(e) =>
                      edit(
                        q.id,
                        e.target.value === "answered" ? value : "",
                        e.target.value as ResponseStatus,
                      )
                    }
                  >
                    <option value="answered">I can answer</option>
                    <option value="unknown">I don’t know</option>
                    <option value="unavailable">Not available yet</option>
                  </select>
                </label>
                {status === "answered" &&
                  (q.type === "schedule" ? (
                    <ScheduleInput
                      id={q.id}
                      fields={q.scheduleFields ?? []}
                      value={value}
                      documents={view.documents}
                      locations={locationOptions(view.locations)}
                      onDraftChange={(v) => edit(q.id, v, "answered")}
                    />
                  ) : q.type === "boolean" || q.type === "select" ? (
                    <select
                      id={"intake-" + q.id}
                      value={value}
                      onChange={(e) => edit(q.id, e.target.value, "answered")}
                    >
                      <option value="">Choose an answer</option>
                      {(q.type === "boolean"
                        ? ["yes", "no"]
                        : (q.options ?? [])
                      ).map((o) => (
                        <option key={o} value={o}>
                          {o === "yes" ? "Yes" : o === "no" ? "No" : o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <textarea
                      id={"intake-" + q.id}
                      rows={3}
                      maxLength={6000}
                      inputMode={q.type === "number" ? "decimal" : undefined}
                      value={value}
                      onChange={(e) => edit(q.id, e.target.value, "answered")}
                    />
                  ))}
                <p className="fine">
                  {view.verifiedIds.includes(q.id)
                    ? "Broker reviewed statement"
                    : a?.source === "broker_recorded"
                      ? "Recorded by your broker"
                      : "Client information"}{" "}
                  · Changes save automatically.
                </p>
                {raw && (
                  <p role="alert">
                    Draft saved, but it needs correction: {raw.error}
                  </p>
                )}
                {blocked && d && (
                  <p className="notice">
                    Latest saved answer:{" "}
                    {a?.status && a.status !== "answered"
                      ? a.status
                      : a?.value || "Not provided"}
                    . Your draft remains in the field above.
                  </p>
                )}
                <details>
                  <summary>Why this question is here</summary>
                  <p>{q.label}</p>
                  <p className="fine">
                    Common broker intake · {q.provenance.reference} ·{" "}
                    {q.provenance.version}. Specific insurer forms may require
                    additional information.
                  </p>
                </details>
                {broker && (
                  <form
                    action={async (f) => {
                      await sendNote(
                        "clarification_request",
                        { questionId: q.id },
                        "ask:" + q.id,
                        "prompt",
                        f,
                      );
                    }}
                  >
                    <label>
                      Ask the client about this answer
                      <textarea
                        name="prompt"
                        aria-label="Ask the client about this answer"
                        value={notes["ask:" + q.id] ?? ""}
                        onChange={(e) =>
                          editNote("ask:" + q.id, e.target.value)
                        }
                        minLength={5}
                        maxLength={2000}
                        required
                      />
                    </label>
                    <button disabled={pending > 0 || blocked}>
                      Request clarification
                    </button>
                  </form>
                )}
              </article>
            );
          })}
      {step === 1 && (
        <section className="panel">
          <h3>Supporting documents</h3>
          <p>
            If a document isn’t available yet, tell your broker when sending
            your intake.
          </p>
          <Link
            href={`/?business=${view.id}&tab=Documents`}
            target="_blank"
            rel="noreferrer"
          >
            Open secure document uploads
          </Link>
          <ul>
            {view.documents.map((d) => (
              <li key={d.id}>{d.name}</li>
            ))}
          </ul>
        </section>
      )}
      {step === 3 && (
        <>
          <section className="panel">
            <h3>Items your broker will need to review</h3>
            <p>
              {view.gaps.length} information gaps. You can still send this
              intake.
            </p>
            <ul>
              {view.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </section>
          {!broker && (
            <section className="panel">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Send my saved answers and identified gaps to my broker for
                review.
              </label>
              <button
                disabled={
                  !confirmed || pending > 0 || blocked || activeDirty > 0
                }
                onClick={() => void run("submit_intake", { confirmed: "yes" })}
              >
                Submit to broker
              </button>
              <p className="fine">
                This handoff does not bind insurance or sign an insurer’s
                application declaration.
              </p>
            </section>
          )}
          <section className="panel">
            <h3>Submission receipts</h3>
            {!view.submissions.length && <p>Not submitted yet.</p>}
            {view.submissions.map((s) => (
              <p key={s.id}>
                Submitted {workflowTime(s.submittedAt)} · Revision {s.revision}{" "}
                · {s.gaps.length} gaps at submission
                {view.revision > s.revision
                  ? " · application updated since this receipt"
                  : ""}
              </p>
            ))}
          </section>
        </>
      )}
      <section className="panel">
        <h3>Questions from your broker</h3>
        {!view.requests.length && <p>No clarification requests.</p>}
        {view.requests.map((r) => (
          <article key={r.id} className="clarification">
            <a
              href={"#guided-" + r.questionId}
              onClick={() => {
                const q = view.questions.find((q) => q.id === r.questionId);
                if (q) setStep(stage(q));
              }}
            >
              Related question:{" "}
              {labels[r.questionId] ??
                view.questions.find((q) => q.id === r.questionId)?.label ??
                r.questionId}
            </a>
            <p>
              <strong>{r.prompt}</strong>
            </p>
            <p>
              {r.response
                ? "Client response: " + r.response
                : "Awaiting client response"}
            </p>
            {r.resolvedAt ? (
              <p>Broker resolution: {r.resolution}</p>
            ) : broker ? (
              <form
                action={async (f) => {
                  await sendNote(
                    "clarification_resolve",
                    { requestId: r.id },
                    "resolve:" + r.id,
                    "resolution",
                    f,
                  );
                }}
              >
                <label>
                  Record your resolution
                  <textarea
                    name="resolution"
                    aria-label="Record your resolution"
                    value={notes["resolve:" + r.id] ?? ""}
                    onChange={(e) =>
                      editNote("resolve:" + r.id, e.target.value)
                    }
                    minLength={5}
                    maxLength={2000}
                    required
                  />
                </label>
                <button disabled={pending > 0 || blocked}>
                  Resolve request
                </button>
              </form>
            ) : (
              <form
                action={async (f) => {
                  await sendNote(
                    "clarification_response",
                    { requestId: r.id },
                    "reply:" + r.id,
                    "response",
                    f,
                  );
                }}
              >
                <label>
                  Your response
                  <textarea
                    name="response"
                    aria-label="Your response"
                    value={notes["reply:" + r.id] ?? r.response ?? ""}
                    onChange={(e) => editNote("reply:" + r.id, e.target.value)}
                    required
                    maxLength={4000}
                  />
                </label>
                <p className="fine">
                  Use Send response to save this message. Update the related
                  answer above when appropriate.
                </p>
                <button disabled={pending > 0 || blocked}>Send response</button>
              </form>
            )}
          </article>
        ))}
      </section>
      <div className="intake-controls">
        <button
          className="secondary"
          disabled={step === 0 || pending > 0}
          onClick={async () => {
            await flush();
            if (!halted.current) goToStep(step - 1);
          }}
        >
          Back
        </button>
        <button
          disabled={step === 3 || pending > 0 || blocked}
          onClick={async () => {
            await flush();
            if (!halted.current) goToStep(step + 1);
          }}
        >
          Save and continue
        </button>
      </div>
    </div>
  );
}
