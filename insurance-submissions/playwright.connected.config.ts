import { defineConfig } from "@playwright/test";
import { verifyStaging } from "./scripts/verify-staging.mjs";
if (!verifyStaging(process.env).local)
  throw new Error(
    "Connected acceptance requires the local captured-email stack",
  );
if (!process.env.CONNECTED_FIXTURE_FILE)
  throw new Error("Provision the fictional connected fixture first");
export default defineConfig({
  testDir: "./tests/connected",
  workers: 1,
  timeout: 240000,
  // These tests handle authentication and captured confirmation links. Avoid
  // retaining traces/network bodies or screenshots containing those secrets.
  use: {
    baseURL: "http://127.0.0.1:3102",
    trace: "off",
    screenshot: "off",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  outputDir: "/tmp/underwriting-private-staging/browser-results",
  webServer: {
    // NEXT_PUBLIC_* values are compiled by Next.js: rebuild with the isolated
    // stack's values instead of reusing any earlier production/demo build.
    command:
      "node scripts/verify-staging.mjs && npm run build && npm start -- --port 3102",
    url: "http://127.0.0.1:3102",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DEMO_MODE: "false",
      NODE_USE_ENV_PROXY: "0",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
