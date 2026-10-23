"use client";
import type { LocationOption } from "@/lib/location-options";
import { useState, useEffect } from "react";
import {
  SCHEDULES,
  scheduleRows,
  scheduleFieldActive,
} from "@/lib/coverage-intake";
export function ScheduleInput({
  id,
  value,
  documents,
  onDraftChange,
  locations = [],
}: {
  locations?: LocationOption[];
  id: string;
  value?: string;
  documents: { id: string; name: string }[];
  onDraftChange?: (value: string) => void;
}) {
  const [rows, setRows] = useState<Record<string, string>[]>(() => {
    try {
      return scheduleRows(value || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      setRows((current) =>
        JSON.stringify(current) === (value || "[]")
          ? current
          : scheduleRows(value || "[]"),
      );
    } catch {}
  }, [value]);
  const updateRows = (next: Record<string, string>[]) => {
    setRows(next);
    onDraftChange?.(JSON.stringify(next));
  };
  const fields = SCHEDULES[id];
  return (
    <div id={`answer-${id}`}>
      <input type="hidden" name="value" value={JSON.stringify(rows)} />
      <p className="fine">
        {id === "locations"
          ? "Add each business address. Locations are linked automatically."
          : id === "property_schedule"
            ? "Choose a saved business address for each property record. Save new locations in Locations first."
            : "Add one record per item."}{" "}
        Save partial information if necessary; missing fields remain open and
        block final approval. Maximum 50 records.
      </p>
      {rows.map((row, i) => (
        <fieldset className="schedule-record" key={i}>
          <legend>
            {id === "locations" ? "Location" : "Record"} {i + 1}
          </legend>
          <div className="form-grid">
            {fields
              .filter(
                (f) =>
                  scheduleFieldActive(id, f, row) &&
                  !(id === "locations" && f.id === "reference"),
              )
              .map((f) => (
                <label key={f.id}>
                  {id === "property_schedule" && f.id === "location"
                    ? "Business location"
                    : f.label}
                  {f.required ? " *" : ""}
                  {id === "property_schedule" && f.id === "location" ? (
                    <select
                      aria-label={`Business location, record ${i + 1}`}
                      value={row.location || ""}
                      onChange={(e) =>
                        updateRows(
                          rows.map((r, n) =>
                            n === i ? { ...r, location: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      <option value="">
                        {locations.length
                          ? "Choose a saved address"
                          : "Save a business location first"}
                      </option>
                      {row.location &&
                        !locations.some((l) => l.id === row.location) && (
                          <option value={row.location} disabled>
                            Previously linked location unavailable — choose a
                            saved address
                          </option>
                        )}
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  ) : f.options || f.type === "document" ? (
                    <select
                      aria-label={`${f.label}, record ${i + 1}`}
                      value={row[f.id] || ""}
                      onChange={(e) =>
                        updateRows(
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
                        updateRows(
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
            onClick={() => updateRows(rows.filter((_, n) => n !== i))}
          >
            Remove record {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="secondary small-button"
        disabled={rows.length >= 50}
        onClick={() =>
          updateRows([
            ...rows,
            id === "locations" ? { reference: crypto.randomUUID() } : {},
          ])
        }
      >
        Add record
      </button>
    </div>
  );
}
