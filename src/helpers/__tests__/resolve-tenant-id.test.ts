import { describe, it, expect } from "vitest";
import { resolveTenantId, resolveTenantIdForWrite } from "../resolve-tenant-id.js";

const oneTenant = [{ tenantId: "t1", tenantName: "Only Co" }];
const twoTenants = [
  { tenantId: "t1", tenantName: "Alpha Co" },
  { tenantId: "t2", tenantName: "Beta Co" },
];

describe("resolveTenantId", () => {
  it("returns the active tenant when no override is given", () => {
    expect(resolveTenantId(twoTenants, "t1")).toBe("t1");
  });

  it("returns a valid override", () => {
    expect(resolveTenantId(twoTenants, "t1", "t2")).toBe("t2");
  });

  it("rejects an override that is not a connected tenant", () => {
    expect(() => resolveTenantId(twoTenants, "t1", "unknown")).toThrow(
      'Tenant ID "unknown" not found in connected tenants.',
    );
  });
});

describe("resolveTenantIdForWrite", () => {
  it("allows the active tenant when only one tenant is connected", () => {
    expect(resolveTenantIdForWrite(oneTenant, "t1")).toBe("t1");
  });

  it("refuses to fall back to the active tenant when multiple tenants are connected", () => {
    expect(() => resolveTenantIdForWrite(twoTenants, "t1")).toThrow(
      /requires an explicit tenantId/,
    );
  });

  it("accepts an explicit override even with multiple tenants connected", () => {
    expect(resolveTenantIdForWrite(twoTenants, "t1", "t2")).toBe("t2");
  });

  it("rejects an explicit override that is not a connected tenant", () => {
    expect(() =>
      resolveTenantIdForWrite(twoTenants, "t1", "unknown"),
    ).toThrow('Tenant ID "unknown" not found in connected tenants.');
  });
});
