export type Role = "admin" | "broker" | "client";
export type Actor = {
  id: string;
  organizationId: string;
  role: Role;
  name: string;
};
export type Answer = {
  value: string;
  source: "client_statement" | "broker_recorded";
  recordedBy: string;
  recordedAt: string;
  questionVersion: string;
  verifiedBy?: string;
  verifiedAt?: string;
};
export type Profile = {
  legalName: string;
  operatingName: string;
  city: string;
  province: "ON";
  industry: "hvac" | "electrical" | "plumbing" | "general";
  description: string;
};
export type DocumentRecord = {
  id: string;
  name: string;
  kind: "loss_runs" | "valuation" | "other";
  path: string;
  size: number;
  mime: string;
  sha256: string;
  uploadedBy: string;
  uploadedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  fictional?: boolean;
};
export type AIPlan = {
  overviewQuestionIds: string[];
  coverageCodes: string[];
  followUpQuestionIds: string[];
};
export type Draft = {
  id: string;
  revision: number;
  mode: "ai" | "rules";
  model: string;
  generatedAt: string;
  plan: AIPlan;
};
export type Approval = {
  id: string;
  revision: number;
  draftId: string;
  brokerId: string;
  brokerName: string;
  approvedAt: string;
  digest: string;
};
export type BusinessState = {
  id: string;
  organizationId: string;
  assignedClientIds: string[];
  revision: number;
  rulesVersion: string;
  fictional: boolean;
  profile: Profile;
  answers: Record<string, Answer>;
  documents: DocumentRecord[];
  draft?: Draft;
  approval?: Approval;
};
export type AuditEvent = {
  id: string;
  businessId: string;
  actorId: string;
  actorName: string;
  action: string;
  revision: number;
  at: string;
  detail: Record<string, unknown>;
};
export type Snapshot = {
  id: string;
  businessId: string;
  approvalId: string;
  revision: number;
  generatedAt: string;
  digest: string;
  content: string;
};
export type Rule = {
  id: string;
  label: string;
  section: string;
  type: "text" | "number" | "boolean" | "select" | "schedule";
  options?: string[];
  industries?: Profile["industry"][];
  when?: { id: string; equals: string };
  scheduleFields?: import("./coverage-intake").ScheduleField[];
  dependsOn?: string[];
  conditions?: { id: string; equals: string }[];
  required: boolean;
  min?: number;
  max?: number;
  provenance: {
    source: string;
    reference: string;
    version: string;
    owner: "client" | "broker" | "underwriter";
  };
};
