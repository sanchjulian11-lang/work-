import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { DEMO_BROKER, DEMO_CLIENT } from "./sample";
import type { Actor } from "./types";
export function isDemo() {
  return process.env.DEMO_MODE === "true";
}
export function configured() {
  return (
    isDemo() ||
    Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )
  );
}
export async function sessionClient() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            for (const { name, value, options } of items)
              jar.set(name, value, options);
          } catch {
            /* Server component refresh is handled on the next action. */
          }
        },
      },
    },
  );
}
export function serviceClient() {
  if (isDemo()) throw new Error("Live services are disabled in demo mode");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function currentActor(): Promise<Actor | null> {
  if (!configured()) return null;
  if (isDemo())
    return (await cookies()).get("demo-role")?.value === "client"
      ? DEMO_CLIENT
      : DEMO_BROKER;
  const db = await sessionClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return null;
  const { data: membership, error: memberError } = await db
    .from("memberships")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .single();
  if (memberError || !membership) return null;
  return {
    id: user.id,
    organizationId: membership.organization_id,
    role: membership.role,
    name: user.email ?? user.id,
  };
}
