// Only known local destinations are allowed; never redirect to a submitted URL.
const actionTabs: Record<string, string> = {
  answer: "Questionnaire",
  verify: "Questionnaire",
  upload: "Documents",
  document_review: "Documents",
  profile: "Business profile",
  assign_client: "Business profile",
  draft: "Broker review",
  approve: "Broker review",
  create: "Overview",
};
export function actionDestination(
  action: string,
  businessId: string,
  kind: "message" | "error",
  text: string,
  questionId = "",
): string {
  const tab = actionTabs[action] ?? "Overview";
  const params = new URLSearchParams({
    business: businessId,
    tab,
    [kind]: text,
  });
  let anchor = "";
  if (tab === "Questionnaire" && /^[a-z][a-z_]{0,79}$/.test(questionId)) {
    params.set("question", questionId);
    anchor = `#question-${questionId}`;
  }
  return `/?${params.toString()}${anchor}`;
}
