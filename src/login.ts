#!/usr/bin/env node

// Standalone Xero OAuth login. Run this any time you want to (re)authorize —
// for example, after granting your Xero app access to a new organisation in
// the Xero developer portal — to refresh consent and pull the new tenant
// into the connections list. Loops so you can authorize several
// organisations in one session.

import dotenv from "dotenv";
import readline from "readline/promises";

dotenv.config();

// Force auth_code mode regardless of the current XERO_AUTH_MODE so this
// script behaves the same whether or not the MCP config has it set.
process.env.XERO_AUTH_MODE = "auth_code";

if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET) {
  process.stderr.write(
    "[Xero Login] XERO_CLIENT_ID and XERO_CLIENT_SECRET must be set (env or .env).\n",
  );
  process.exit(1);
}

const { xeroClient } = await import("./clients/xero-client.js");
const { TokenStore } = await import("./clients/token-store.js");

const tokenStore = new TokenStore(process.env.XERO_TOKEN_STORE_PATH);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stderr,
});

async function runOnce(): Promise<void> {
  // Reset both the in-memory token and the stored token so authenticate()
  // doesn't short-circuit on a previous iteration's valid token, or
  // silently refresh the stored one — we want the consent screen.
  // xero-node's setTokenSet rejects an undefined access_token, so pass a
  // placeholder with expires_at: 0 to mark it stale.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (xeroClient as any).setTokenSet({ access_token: "expired", expires_at: 0 });
  await tokenStore.clear();

  process.stderr.write(
    "[Xero Login] Starting OAuth flow — sign in and pick the org(s) to authorize.\n",
  );
  await xeroClient.authenticate();
  process.stderr.write("[Xero Login] Authorization saved.\n");
}

try {
  while (true) {
    await runOnce();
    const answer = await rl.question(
      "\n[Xero Login] Authorize another Xero organisation? (y/N): ",
    );
    if (answer.trim().toLowerCase() !== "y") break;
  }
  process.stderr.write("[Xero Login] Done.\n");
  rl.close();
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`\n[Xero Login] Failed: ${message}\n`);
  rl.close();
  process.exit(1);
}
