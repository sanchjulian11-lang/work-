import { describe, it, expect } from "vitest";
import { verifyStaging } from "../scripts/verify-staging.mjs";
const env = {
  APP_ENV: "staging",
  DEMO_MODE: "false",
  AI_PROCESSING_ENABLED: "false",
  STAGING_SUPABASE_PROJECT_REF: "fictionaltestproject",
  NEXT_PUBLIC_SUPABASE_URL: "https://fictionaltestproject.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fictional-public-key",
  SUPABASE_SERVICE_ROLE_KEY: "fictional-server-key",
  VERCEL: "1",
  VERCEL_PROJECT_ID: "prj_fictionalstage",
  STAGING_VERCEL_PROJECT_ID: "prj_fictionalstage",
};
const jwt = (ref: string, role: string) =>
  "header." +
  Buffer.from(JSON.stringify({ ref, role })).toString("base64url") +
  ".signature";
describe("staging deployment isolation", () => {
  it("permits only an explicitly configured separate staging project", () => {
    expect(verifyStaging(env)).toEqual({
      projectRef: "fictionaltestproject",
      local: false,
    });
    expect(() => verifyStaging({ ...env, APP_ENV: "production" })).toThrow(
      "APP_ENV",
    );
    expect(() => verifyStaging({ ...env, DEMO_MODE: "true" })).toThrow(
      "DEMO_MODE",
    );
    expect(() =>
      verifyStaging({ ...env, AI_PROCESSING_ENABLED: "true" }),
    ).toThrow("disabled");
  });
  it("rejects the existing database even if its project reference is supplied as staging", () => {
    expect(() =>
      verifyStaging({
        ...env,
        NEXT_PUBLIC_SUPABASE_URL: "https://bhxxrzblghgtytimthqw.supabase.co",
      }),
    ).toThrow("pinned test project");
    expect(() =>
      verifyStaging({
        ...env,
        STAGING_SUPABASE_PROJECT_REF: "bhxxrzblghgtytimthqw",
        NEXT_PUBLIC_SUPABASE_URL: "https://bhxxrzblghgtytimthqw.supabase.co",
      }),
    ).toThrow("separate test");
  });
  it("rejects accidental deployment into a different Vercel project or with missing credentials", () => {
    expect(() =>
      verifyStaging({ ...env, VERCEL_PROJECT_ID: "prj_original" }),
    ).toThrow("pinned staging project");
    expect(() =>
      verifyStaging({ ...env, SUPABASE_SERVICE_ROLE_KEY: "" }),
    ).toThrow("missing");
  });
  it("rejects mismatched JWT project references and public keys used as server keys", () => {
    expect(() =>
      verifyStaging({
        ...env,
        SUPABASE_SERVICE_ROLE_KEY: jwt("bhxxrzblghgtytimthqw", "service_role"),
      }),
    ).toThrow("different Supabase");
    expect(() =>
      verifyStaging({
        ...env,
        SUPABASE_SERVICE_ROLE_KEY: jwt("fictionaltestproject", "anon"),
      }),
    ).toThrow("wrong role");
    expect(() =>
      verifyStaging({
        ...env,
        SUPABASE_SERVICE_ROLE_KEY: jwt("fictionaltestproject", "service_role"),
      }),
    ).not.toThrow();
  });
  it("allows a clearly identified local test stack but never deploys its URL to Vercel", () => {
    const local = {
      ...env,
      VERCEL: "",
      STAGING_SUPABASE_PROJECT_REF: "local-staging",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55421",
    };
    expect(verifyStaging(local).local).toBe(true);
    expect(() => verifyStaging({ ...local, VERCEL: "1" })).toThrow(
      "hosted test database",
    );
  });
});
