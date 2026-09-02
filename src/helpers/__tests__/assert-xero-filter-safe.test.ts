import { describe, it, expect } from "vitest";
import {
  assertGuidForFilter,
  assertSafeFilterString,
} from "../assert-xero-filter-safe.js";

describe("assertGuidForFilter", () => {
  it("returns the value when it is a well-formed GUID", () => {
    const guid = "550e8400-e29b-41d4-a716-446655440000";
    expect(assertGuidForFilter(guid, "invoiceId")).toBe(guid);
  });

  it("rejects a value that would break out of the guid() filter", () => {
    expect(() =>
      assertGuidForFilter('") || true || guid("00000000-0000-0000-0000-000000000000', "invoiceId"),
    ).toThrow('Invalid invoiceId: expected a GUID');
  });

  it("rejects a plain non-GUID string", () => {
    expect(() => assertGuidForFilter("not-a-guid", "paymentId")).toThrow(
      "Invalid paymentId: expected a GUID",
    );
  });
});

describe("assertSafeFilterString", () => {
  it("returns the value when it contains no quote or backslash", () => {
    expect(assertSafeFilterString("INV-0042", "invoiceNumber")).toBe("INV-0042");
  });

  it("rejects a value containing a double quote", () => {
    expect(() =>
      assertSafeFilterString('") || Reference!="', "reference"),
    ).toThrow("Invalid reference: must not contain quote or backslash characters");
  });

  it("rejects a value containing a backslash", () => {
    expect(() => assertSafeFilterString("foo\\bar", "reference")).toThrow(
      "Invalid reference: must not contain quote or backslash characters",
    );
  });
});
