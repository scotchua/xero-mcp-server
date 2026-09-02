import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { resolveLocalFilePath } from "../resolve-local-file-path.js";

const ORIGINAL_ENV = process.env.XERO_FILES_DIR;

describe("resolveLocalFilePath", () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.XERO_FILES_DIR;
    } else {
      process.env.XERO_FILES_DIR = ORIGINAL_ENV;
    }
  });

  it("refuses to read a local file when XERO_FILES_DIR is not set", () => {
    delete process.env.XERO_FILES_DIR;
    expect(() => resolveLocalFilePath("receipt.pdf")).toThrow(
      /requires XERO_FILES_DIR/,
    );
  });

  describe("with XERO_FILES_DIR set", () => {
    beforeEach(() => {
      process.env.XERO_FILES_DIR = "/tmp/xero-files";
    });

    it("resolves a relative path inside the directory", () => {
      expect(resolveLocalFilePath("receipt.pdf")).toBe(
        path.resolve("/tmp/xero-files/receipt.pdf"),
      );
    });

    it("resolves a nested relative path inside the directory", () => {
      expect(resolveLocalFilePath("2026/receipt.pdf")).toBe(
        path.resolve("/tmp/xero-files/2026/receipt.pdf"),
      );
    });

    it("rejects a path that escapes the directory via ..", () => {
      expect(() => resolveLocalFilePath("../secrets.env")).toThrow(
        /must resolve inside XERO_FILES_DIR/,
      );
    });

    it("rejects an absolute path outside the directory", () => {
      expect(() => resolveLocalFilePath("/etc/passwd")).toThrow(
        /must resolve inside XERO_FILES_DIR/,
      );
    });
  });
});
