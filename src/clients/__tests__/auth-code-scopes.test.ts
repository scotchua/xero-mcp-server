import { afterEach, describe, expect, it, vi } from "vitest";

async function loadScopes(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.stubEnv("XERO_CLIENT_ID", "test-id");
  vi.stubEnv("XERO_CLIENT_SECRET", "test-secret");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  return await import("../xero-client.js");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth-code default scopes", () => {
  it("requests granular scopes, never the bundled V1 ones", async () => {
    const { XERO_AUTH_CODE_SCOPES, XERO_SCOPES_V2 } = await loadScopes({
      XERO_SCOPES: undefined,
    });
    const requested = XERO_AUTH_CODE_SCOPES.split(" ");
    expect(requested).toEqual(
      expect.arrayContaining(["openid", "profile", "email", "offline_access", ...XERO_SCOPES_V2]),
    );
    expect(requested).not.toContain("accounting.transactions");
    expect(requested).not.toContain("accounting.reports.read");
  });

  it("uses XERO_SCOPES when set", async () => {
    const { XERO_AUTH_CODE_SCOPES } = await loadScopes({
      XERO_SCOPES: "openid accounting.transactions",
    });
    expect(XERO_AUTH_CODE_SCOPES).toBe("openid accounting.transactions");
  });
});
