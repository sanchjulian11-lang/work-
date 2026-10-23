"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { updateQuestion } from "@/app/actions";
type Feedback = { id: string; text: string; error?: boolean };
type Session = {
  businessId: string;
  revision: number;
  read: (id: string) => string | undefined;
  write: (id: string, value: string) => void;
  enqueue: (
    id: string,
    value: string,
    action?: "answer" | "verify",
  ) => Promise<void>;
  feedback: Feedback | null;
  pending: number;
  blocked: boolean;
};
const Context = createContext<Session | null>(null);
export function useQuestionnaire() {
  const c = useContext(Context);
  if (!c) throw new Error("Questionnaire session missing");
  return c;
}
export function QuestionnaireSession({
  businessId,
  revision,
  children,
  autoSave = true,
}: {
  businessId: string;
  revision: number;
  children: ReactNode;
  autoSave?: boolean;
}) {
  const router = useRouter();
  const revisionRef = useRef(revision);
  const drafts = useRef(new Map<string, string>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const outstanding = useRef(0);
  const halted = useRef(false);
  const changedOnServer = useRef(false);
  const [pending, setPending] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const reviewing = useRef(false);
  useEffect(() => {
    if (!outstanding.current && revision > revisionRef.current)
      revisionRef.current = revision;
    if (reviewing.current && !refreshing) {
      revisionRef.current = revision;
      halted.current = false;
      setBlocked(false);
      reviewing.current = false;
      setFeedback(null);
    }
  }, [revision, refreshing]);
  const read = useCallback((id: string) => drafts.current.get(id), []);
  const write = useCallback((id: string, value: string) => {
    drafts.current.set(id, value);
  }, []);
  function enqueue(
    id: string,
    value: string,
    action: "answer" | "verify" = "answer",
  ) {
    outstanding.current++;
    setPending(outstanding.current);
    setFeedback({
      id,
      text: action === "verify" ? "Recording verification…" : "Saving…",
    });
    const task = queue.current.then(async () => {
      try {
        if (halted.current) {
          return;
        }
        const form = new FormData();
        for (const [k, v] of Object.entries({
          businessId,
          revision: String(revisionRef.current),
          questionId: id,
          value,
          action,
        }))
          form.set(k, v);
        const result = await updateQuestion(form);
        if (result.error) {
          setFeedback({ id, text: result.error, error: true });
          if (result.conflict) {
            halted.current = true;
            setBlocked(true);
          }
        } else if (result.revision) {
          revisionRef.current = result.revision;
          changedOnServer.current = true;
          if (action === "answer" && drafts.current.get(id) === value)
            drafts.current.delete(id);
          if (outstanding.current === 1)
            setFeedback({
              id,
              text: action === "verify" ? "Verification recorded" : "Saved",
            });
        }
      } catch {
        halted.current = true;
        setBlocked(true);
        setFeedback({
          id,
          text: "Save could not be confirmed. Your unsaved input remains here. Review the latest version before retrying.",
          error: true,
        });
      } finally {
        outstanding.current--;
        setPending(outstanding.current);
        if (!outstanding.current && changedOnServer.current) {
          changedOnServer.current = false;
          startRefresh(() => router.refresh());
        }
      }
    });
    queue.current = task;
    return task;
  }
  return (
    <Context.Provider
      value={{
        businessId,
        revision: revisionRef.current,
        read,
        write,
        enqueue,
        feedback,
        pending,
        blocked,
      }}
    >
      {autoSave && (
        <p className="fine">
          Yes/No selections save automatically. Text, numbers and schedules use
          Save answer. Saving does not verify an answer.
        </p>
      )}
      {blocked && (
        <div role="alert" className="notice error">
          Saving paused to prevent overwriting another change. Unsaved drafts
          stay in this tab.{" "}
          <button
            type="button"
            disabled={refreshing || pending > 0}
            onClick={() => {
              reviewing.current = true;
              startRefresh(() => router.refresh());
            }}
          >
            Review latest version
          </button>{" "}
          Review your draft against the latest saved information before
          retrying.
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
export function QuestionFeedback({ id }: { id: string }) {
  const session = useQuestionnaire();
  const f = session.feedback;
  if (f?.id !== id) return null;
  return (
    <p
      className={f.error ? "notice error" : "notice success"}
      role={f.error ? "alert" : "status"}
    >
      {f.text}
    </p>
  );
}
