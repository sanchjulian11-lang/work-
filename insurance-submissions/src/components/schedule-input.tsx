"use client";
import { useState } from "react";
import {
  SCHEDULES,
  scheduleRows,
  scheduleFieldActive,
} from "@/lib/coverage-intake";
export function ScheduleInput({
  id,
  value,
  documents,
}: {
  id: string;
  value?: string;
  documents: { id: string; name: string }[];
}) {
  const [rows, setRows] = useState<Record<string, string>[]>(() => {
    try {
      return scheduleRows(value || "[]");
    } catch {
      return [];
    }
  });
  const fields = SCHEDULES[id];
  return (
    <div id={`answer-${id}`}>
      <input type="hidden" name="value" value={JSON.stringify(rows)} />
      <p className="fine">
        Add one record per item. Save partial information if necessary; missing
        fields remain open and block final approval. Maximum 50 records.
      </p>
      {rows.map((row, i) => (
        <fieldset className="schedule-record" key={i}>
          <legend>Record {i + 1}</legend>
          <div className="form-grid">
            {fields
              .filter((f) => scheduleFieldActive(id, f, row))
              .map((f) => (
                <label key={f.id}>
                  {f.label}
                  {f.required ? " *" : ""}
                  {f.options || f.type === "document" ? (
                    <select
                      aria-label={`${f.label}, record ${i + 1}`}
                      value={row[f.id] || ""}
                      onChange={(e) =>
                        setRows(
                          rows.map((r, n) =>
                            n === i ? { ...r, [f.id]: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      <option value="">Not provided</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                      {f.type === "document" &&
                        documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      aria-label={`${f.label}, record ${i + 1}`}
                      type={f.type === "number" ? "number" : "text"}
                      min={f.type === "number" ? (f.min ?? 0) : undefined}
                      max={f.max}
                      step={f.whole ? "1" : "any"}
                      maxLength={2000}
                      value={row[f.id] || ""}
                      onChange={(e) =>
                        setRows(
                          rows.map((r, n) =>
                            n === i ? { ...r, [f.id]: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  )}
                </label>
              ))}
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => setRows(rows.filter((_, n) => n !== i))}
          >
            Remove record {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="secondary small-button"
        disabled={rows.length >= 50}
        onClick={() => setRows([...rows, {}])}
      >
        Add record
      </button>
    </div>
  );
}
