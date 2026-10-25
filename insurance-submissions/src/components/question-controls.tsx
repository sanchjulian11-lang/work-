"use client";
import { useState, useEffect, useCallback } from "react";
import { useQuestionnaire, QuestionFeedback } from "./questionnaire-session";
import { perform } from "@/app/actions";
import { ScheduleInput } from "./schedule-input";
import type { LocationOption } from "@/lib/location-options";
import type { Rule, Answer } from "@/lib/types";
export function QuestionControls({
  q,
  answer,
  documents,
  broker,
  verified,
  locations,
}: {
  locations: LocationOption[];
  q: Rule;
  answer?: Answer;
  documents: { id: string; name: string }[];
  broker: boolean;
  verified: boolean;
}) {
  const session = useQuestionnaire();
  const [value, setValue] = useState(
    () => session.read(q.id) ?? answer?.value ?? "",
  );
  useEffect(() => {
    if (session.read(q.id) === undefined) setValue(answer?.value ?? "");
  }, [answer?.value, q.id, session.read]);
  const change = useCallback(
    (next: string) => {
      setValue(next);
      session.write(q.id, next);
    },
    [q.id, session.write],
  );
  const disabled =
    (!broker && q.provenance.owner === "broker") || session.blocked;
  const id = `answer-${q.id}`;
  return (
    <>
      <QuestionFeedback id={q.id} />
      <form
        action={perform}
        onSubmit={(e) => {
          e.preventDefault();
          void session.enqueue(q.id, value);
        }}
      >
        <input type="hidden" name="businessId" value={session.businessId} />
        <input type="hidden" name="revision" value={session.revision} />
        <input type="hidden" name="questionId" value={q.id} />
        <input type="hidden" name="action" value="answer" />
        <fieldset disabled={disabled}>
          {q.provenance.owner === "broker" && (
            <p className="fine">Broker decision / review required</p>
          )}
          {q.type === "boolean" ? (
            <select
              id={id}
              name="value"
              value={value}
              onChange={(e) => {
                change(e.target.value);
                void session.enqueue(q.id, e.target.value);
              }}
            >
              <option value="">Not provided</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          ) : q.type === "schedule" ? (
            <ScheduleInput
              id={q.id}
              fields={q.scheduleFields ?? []}
              value={value}
              documents={documents}
              locations={locations}
              onDraftChange={change}
            />
          ) : q.type === "select" ? (
            <select
              id={id}
              name="value"
              value={value}
              onChange={(e) => change(e.target.value)}
            >
              <option value="">Not provided</option>
              {q.options?.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : q.type === "number" ? (
            <input
              id={id}
              name="value"
              type="number"
              min={q.min ?? 0}
              max={q.max ?? 1e10}
              step={["years", "employees"].includes(q.id) ? 1 : ".01"}
              value={value}
              onChange={(e) => change(e.target.value)}
            />
          ) : (
            <textarea
              id={id}
              name="value"
              maxLength={6000}
              rows={3}
              value={value}
              onChange={(e) => change(e.target.value)}
            />
          )}
          <div className="answer-actions">
            {q.type !== "boolean" ? (
              <button
                disabled={session.pending > 0}
                className="secondary small-button"
              >
                Save answer
              </button>
            ) : (
              <span className="fine">Saves automatically</span>
            )}
            {q.type === "boolean" &&
              session.read(q.id) !== undefined &&
              session.pending === 0 && (
                <button className="secondary small-button">Retry save</button>
              )}
            <span className="fine">
              {session.read(q.id) !== undefined
                ? "Unsaved changes"
                : answer
                  ? `${answer.source === "client_statement" ? "Client statement" : "Broker recorded"}`
                  : "No recorded statement"}
            </span>
          </div>
        </fieldset>
      </form>
      {broker && answer?.value && !verified && (
        <button
          className="text-button"
          disabled={
            session.pending > 0 || session.blocked || value !== answer.value
          }
          onClick={() => void session.enqueue(q.id, "", "verify")}
        >
          Verify recorded statement
        </button>
      )}
    </>
  );
}
