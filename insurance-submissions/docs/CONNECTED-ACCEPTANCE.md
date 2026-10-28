# Connected-service acceptance checklist

Local domain, PostgreSQL-policy, mocked-AI, and fictional-browser tests do not replace these hosted-service checks. Use fictional data until all required checks and organizational review are complete.

## Supabase Auth and access

- Apply the migration in a fresh project and run the documented sandbox bootstrap.
- Sign in as broker and client in separate browser profiles. Confirm logout and expired-session refresh work.
- Confirm the assigned client can record answers and upload evidence, but cannot verify statements, see broker drafts/audit/snapshots, approve, or export.
- Create an unassigned client and a second-organization broker via a trusted admin process. Confirm they cannot read the sample account, download its files, or call mutation RPCs through their own tokens.
- Change a membership role administratively and confirm server authorization uses the new database role.
- In the broker UI create a new profile, assign an existing client, and confirm assignment/removal affects portal access immediately.
- After approval to stage this increment, apply `202610270001_client_workflow.sql`
  after the initial migration in the isolated staging project. Confirm public,
  anon and authenticated roles cannot access invitation rows or invoke claim,
  create or revoke RPCs directly.
- With fictional recipients only, test existing-account login and new-account
  email confirmation/return to the private link. Confirm disabled/unconfirmed,
  expired/revoked/used links, wrong-email and other-organization identities fail.
- Confirm the configured Supabase Site URL, confirmation redirect allowlist,
  password policy, signup policy and rate limits in staging. No new invitation
  email delivery service is implemented; share links only through approved channels.
- Save/resume in separate client and broker profiles, submit with unknowns,
  request/respond/resolve a question-linked clarification and confirm the submitted
  revision/gap receipt remains intact after later edits. Repeat with session expiry
  and a network interruption. Remove client assignment and verify access is denied.

## Storage

- Upload fictional PDF, PNG, and JPEG files. Confirm private bucket access, opaque paths, hashes, and audit metadata.
- Reject renamed HTML, empty files, unsupported extensions, and files over 4 MB.
- Review the document and confirm that its review becomes stale with any new replacement upload (replacements are new records, never overwrite existing evidence).
- Download only with an assigned user or broker. Test expired signed URLs and audit entries.
- Report a fictional loss; confirm loss details plus a reviewed loss record are required for approval.
- Deploy your malware/quarantine workflow and reconciliation for orphan uploads before processing live files. Signature checks alone do not provide those controls.

## AI

- Keep AI disabled until provider use is authorized. Supply the key securely on the server; never in chat, source, or client environment variables.
- Run a fictional AI-assisted draft. Confirm the selected model supports the configured strict JSON schema.
- Check that the request has only question IDs/labels, allowed coverage codes, and outstanding IDs, with `store:false`; no actual answer or document text.
- Confirm API failure does not create a successful draft, unsupported references are rejected, and the rules-based fallback is explicitly labelled.

## Approval and handoff

- Complete every active required answer, remove unresolved placeholder text, and provide a revenue split totalling 100%.
- Verify each recorded statement and review every uploaded document.
- Generate a draft, explicitly approve, and download the final Markdown submission.
- Confirm the business revision, approval ID, digest, source metadata, and document register in storage/history match the export.
- Edit one answer, change trade, add a document, or change client assignments. Confirm approval disappears and the final-export endpoint rejects stale approval.
- Have two broker sessions save the same revision. The second stale update must fail without overwriting the first or creating a false success audit event.
- Confirm that no component sends email or contacts an insurer. Market handling is manual.

## Before real-client rollout

Validate the internal starter questionnaire with the supervising broker, establish privacy/retention and backup policies, review provider agreements and hosting region, add malware scanning and operational monitoring, and complete an application security review. This repository does not claim insurer approval or regulatory certification.
