"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-shell">
      <h1>Unable to load the workspace</h1>
      <p>
        No changes were made by this page. Check the connection and
        configuration, then retry.
      </p>
      <button onClick={reset}>Retry</button>
    </main>
  );
}
