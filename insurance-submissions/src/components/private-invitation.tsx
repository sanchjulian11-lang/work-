"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPrivateLink, revokeLink } from "@/app/intake-actions";
import { workflowTime } from "@/lib/workflow-time";
export function PrivateInvitation({
  businessId,
  invitations,
}: {
  businessId: string;
  invitations: {
    id: string;
    email: string;
    expiresAt: string;
    revokedAt?: string | null;
    claimedAt?: string | null;
  }[];
}) {
  const [link, setLink] = useState(""),
    [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <details className="panel">
      <summary>Private client invitation</summary>
      <p>
        Create a link to share privately with the intended client. This does not
        send email. Recipient must sign in with a matching confirmed email.
      </p>
      <form
        action={(f) =>
          start(async () => {
            const r = await createPrivateLink(f);
            setError(r.error ?? "");
            if (r.path) {
              setLink(window.location.origin + r.path);
              router.refresh();
            }
          })
        }
      >
        <input type="hidden" name="businessId" value={businessId} />
        <label>
          Recipient email
          <input
            name="email"
            type="email"
            required
            placeholder="client@fictional.example"
          />
        </label>
        <label>
          Expires in days
          <input
            name="days"
            type="number"
            defaultValue={7}
            min={1}
            max={14}
            required
          />
        </label>
        <button disabled={pending}>Create private link</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {link && (
        <label>
          Private link — copy it now
          <input
            aria-label="Private invitation link"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
        </label>
      )}
      <ul>
        {invitations.map((i) => (
          <li key={i.id}>
            {i.email} ·{" "}
            {i.claimedAt
              ? "Claimed"
              : i.revokedAt
                ? "Revoked"
                : Date.parse(i.expiresAt) <= Date.now()
                  ? "Expired"
                  : "Pending"}{" "}
            · expires {workflowTime(i.expiresAt)}
            {!i.claimedAt && !i.revokedAt && (
              <button
                className="text-button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      const f = new FormData();
                      f.set("businessId", businessId);
                      f.set("invitationId", i.id);
                      await revokeLink(f);
                      router.refresh();
                    } catch {
                      setError("Unable to revoke invitation");
                    }
                  })
                }
              >
                Revoke invitation
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="fine">
        Revoking an unclaimed link stops its use. For a claimed account, remove
        its client assignment in Business profile to revoke application access.
      </p>
    </details>
  );
}
