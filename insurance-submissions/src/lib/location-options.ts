import { scheduleRows } from "./coverage-intake";
export type LocationOption = { id: string; label: string };
// Only persisted locations are offered; an incomplete draft is never selected silently.
export function locationOptions(value: string | undefined): LocationOption[] {
  try {
    const options = scheduleRows(value || "[]")
      .map((r, index) => ({
        id: r.reference,
        index,
        address: r.address,
        label: `${r.address}${r.tenure?.trim() ? ` — ${r.tenure[0].toUpperCase()}${r.tenure.slice(1)}` : ""}`,
      }))
      .filter((r) => r.id?.trim() && r.address?.trim());
    return options.map((o) => ({
      id: o.id,
      label:
        options.filter((p) => p.label === o.label).length > 1
          ? `${o.label} (Location ${o.index + 1})`
          : o.label,
    }));
  } catch {
    return [];
  }
}
