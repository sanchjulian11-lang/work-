"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimLink, invitationAuth } from "@/app/intake-actions";
import type { Identity } from "@/lib/invitations";
export function InvitationClaim({
  identity,
  demo,
}: {
  identity: Identity | null;
  demo: boolean;
}) {
  const [token, setToken] = useState(""),
    [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    const load = () => {
      setToken(
        new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
      );
      setMessage("");
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);
  return (
    <section className="panel">
      <p role="status">{message}</p>
      {identity && (
        <p>
          Signed in as {identity.email}
          {!identity.verified ? " — email confirmation required" : ""}
        </p>
      )}
      <form
        action={(f) =>
          start(async () => {
            const r = await invitationAuth(f);
            setMessage(r.error ?? r.message ?? "");
            router.refresh();
          })
        }
      >
        {demo ? (
          <p>Demo uses client@fictional.example. No email will be sent.</p>
        ) : (
          <>
            <label>
              Email
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
            <p className="fine">
              Use at least 12 characters when creating an account. You can sign
              in here with a different invited account.
            </p>
            <label>
              Account action
              <select name="mode">
                <option value="login">Sign in</option>
                <option value="signup">Create an account</option>
              </select>
            </label>
          </>
        )}
        <button disabled={pending}>
          {demo ? "Use fictional client identity" : "Continue securely"}
        </button>
      </form>
      <form
        action={(f) =>
          start(async () => {
            const r = await claimLink(f);
            if (r?.error) setMessage(r.error);
          })
        }
      >
        <input type="hidden" name="token" value={token} />
        <p>
          {token
            ? "Private invitation loaded."
            : "Open the complete private invitation link from your broker."}
        </p>
        <button disabled={pending || !identity?.verified || !token}>
          Claim application
        </button>
      </form>
      <p className="fine">
        This link is private, expires, and can be used once. Claiming access
        does not submit an insurance application.
      </p>
    </section>
  );
}
