import { currentIdentity, isDemo } from "@/lib/auth";
import { InvitationClaim } from "@/components/invitation-claim";
export default async function InvitationPage() {
  return (
    <main className="intake-shell">
      <h1>Your private business intake</h1>
      <p>
        Sign in with the email your broker invited, then claim this application.
        New accounts must confirm their email before claiming.
      </p>
      <InvitationClaim identity={await currentIdentity()} demo={isDemo()} />
    </main>
  );
}
